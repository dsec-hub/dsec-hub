import type { NextAuthConfig } from "next-auth";

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

      // Authentication only — per-module authorization is NOT decided here.
      // The JWT carries a login-time role snapshot that cannot see per-user
      // extra grants and goes stale on a role change, so gating here silently
      // denied access the data layer had granted (NEW-HUBAUTHZ-01).
      // `requireModule` in lib/dal.ts is the single authority: it re-reads the
      // effective module set (role ∪ extras) on every page and Server Action.
      // Do not re-add a module gate here.
      return true;
    },
    // Carry id + role + module snapshot from the user record into the JWT.
    // NOTE: token.modules is a login-time snapshot kept only for display
    // (session.user.modules) — it is NOT an authorization input for routing.
    // Authoritative module checks re-read the DB in lib/dal.ts (HUBAUTHZ-01).
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
