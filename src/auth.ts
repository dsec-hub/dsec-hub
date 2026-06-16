import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { authConfig } from "./auth.config";
import { db } from "./db";
import { appUser, appRole } from "./db/schema";
import { logUsage } from "./lib/usage";
import { getClientIp, limitLogin } from "./lib/rate-limit";

/** Thrown when the login throttle trips, so the UI can say so distinctly. */
class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        // Brute-force / credential-stuffing guard. Keyed by IP+email so the
        // throttle bites before bcrypt runs. Proxy excludes /api/auth, so this
        // is the layer that protects login. Fails open if Upstash is unset.
        const ip = request ? getClientIp(request) : "0.0.0.0";
        const { success } = await limitLogin(ip, email);
        if (!success) throw new RateLimitedSignin();

        const [user] = await db
          .select({
            id: appUser.id,
            email: appUser.email,
            name: appUser.name,
            passwordHash: appUser.passwordHash,
            role: appUser.role,
            isActive: appUser.isActive,
            roleId: appUser.roleId,
            roleName: appRole.name,
            modules: appRole.modules,
          })
          .from(appUser)
          .leftJoin(appRole, eq(appUser.roleId, appRole.id))
          .where(eq(appUser.email, email))
          .limit(1);

        if (!user || !user.isActive) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name ?? user.email,
          role: user.roleName ?? user.role,
          roleId: user.roleId ?? undefined,
          // Snapshot of module access, carried in the JWT for the proxy's coarse
          // route gate. Authoritative checks re-read the DB (see lib/dal.ts).
          modules: Array.isArray(user.modules) ? user.modules : [],
        };
      },
    }),
  ],
  events: {
    // Record every successful sign-in for the admin usage stats.
    async signIn({ user }) {
      const id = Number(user?.id);
      await logUsage({
        actorId: Number.isNaN(id) ? null : id,
        actorLabel: user?.email ?? null,
        action: "login",
      });
    },
  },
});
