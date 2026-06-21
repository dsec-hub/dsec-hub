import type { NextAuthConfig } from "next-auth";

import { canAccess, moduleForPath } from "./lib/rbac";

/**
 * Edge/proxy-safe base config: NO database or bcrypt imports, so it can be
 * loaded by `proxy.ts` (which runs on every request) without bundling `pg`.
 * The Credentials provider (which needs the DB) is added in `auth.ts`.
 */
export const authConfig = {
  pages: { signIn: "/signin" },
  session: { strategy: "jwt" },
  providers: [], // real provider added in auth.ts
  callbacks: {
    // Route gate, evaluated in the proxy on every matched request.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;

      // Public routes: the sign-in page and the invite-acceptance flow.
      if (path === "/signin") {
        return isLoggedIn ? Response.redirect(new URL("/", nextUrl)) : true;
      }
      if (path.startsWith("/invite")) return true;
      // Public, read-only meeting-agenda share links (/agenda/<token>). The token
      // itself is the credential; the page only ever resolves shared/locked
      // agendas (a draft / wrong token / archived meeting reads as not-found).
      if (path.startsWith("/agenda")) return true;

      if (!isLoggedIn) return false; // everything else requires a session

      // Coarse, JWT-based module gate. Authoritative re-check happens in the
      // DAL on every data read / Server Action (defense in depth).
      const moduleKey = moduleForPath(path);
      if (moduleKey && !canAccess(auth!.user.modules, moduleKey)) {
        // Don't dump them on a blank dashboard with no explanation — send them
        // to an access-denied page that names what they tried to open.
        return Response.redirect(new URL(`/dashboard/access-denied?from=${moduleKey}`, nextUrl));
      }
      return true;
    },
    // Carry id + role + module snapshot from the user record into the JWT…
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.roleId = user.roleId;
        token.modules = user.modules ?? [];
      }
      return token;
    },
    // …and expose them on the session.
    session({ session, token }) {
      if (session.user) {
        if (typeof token.id === "string") session.user.id = token.id;
        if (typeof token.role === "string") session.user.role = token.role;
        if (typeof token.roleId === "number") session.user.roleId = token.roleId;
        if (Array.isArray(token.modules)) session.user.modules = token.modules;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
