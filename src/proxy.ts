import NextAuth from "next-auth";
import { getToken } from "next-auth/jwt";
import type { NextRequest, NextFetchEvent } from "next/server";

import { authConfig } from "@/auth.config";
import {
  getClientIp,
  limitByIp,
  limitByUser,
  tooManyRequests,
} from "@/lib/rate-limit";

// Next.js 16 renamed Middleware to Proxy. Defaults to the Node.js runtime, so
// the Upstash REST client works here without edge restrictions.
const { auth } = NextAuth(authConfig);

/**
 * Read the signed-in user's id straight from the session JWT, without going
 * through the full `auth()` flow. Returns null for anonymous requests. The
 * secure-cookie prefix is detected from the request itself so this works the
 * same on prod/preview (HTTPS → `__Secure-`) and local dev (HTTP) without
 * depending on NODE_ENV.
 */
async function sessionUserId(req: NextRequest): Promise<string | null> {
  const secureCookie = (req.headers.get("cookie") ?? "").includes(
    "__Secure-authjs.session-token",
  );
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie,
  });
  const id = token?.id;
  return typeof id === "string" ? id : id != null ? String(id) : null;
}

// Rate limit runs FIRST, then we delegate to NextAuth's middleware. Calling
// `auth(req, ctx)` with a real Request re-runs the `authorized` route gate in
// auth.config.ts, so the existing RBAC behaviour is unchanged — we've only
// added a throttle in front of it.
//
// Signed-in sessions are keyed by user id against a generous per-user limit so
// normal dashboard use never trips it; anonymous traffic keeps the tight
// per-IP limit that guards the sign-in / invite pages.
export default async function proxy(req: NextRequest, ctx: NextFetchEvent) {
  const userId = await sessionUserId(req);
  const { success, reset } = userId
    ? await limitByUser(userId)
    : await limitByIp(getClientIp(req));
  if (!success) return tooManyRequests(reset);
  return auth(req as never, ctx as never);
}

export const config = {
  // Run on everything except API routes, Next internals, and static assets.
  // Login (/api/auth/*) is excluded here and throttled inside auth.ts instead.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webp)$).*)"],
};
