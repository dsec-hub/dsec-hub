/**
 * Application-level rate limiting (abuse / scripting / brute-force guard).
 *
 * Volumetric DDoS is blocked upstream at the edge (Cloudflare + Vercel
 * Firewall — see SECURITY.md). This layer stops the things the edge is bad at:
 * credential stuffing on the login form and scripted hammering of an authed
 * session.
 *
 * State lives in Upstash Redis (REST), the only store that gives accurate
 * counts across Vercel's many short-lived function instances. If the Upstash
 * env vars are absent (local dev, or before the account is wired up) every
 * limiter FAILS OPEN — requests pass through unthrottled rather than erroring,
 * so nothing breaks while the service is being set up.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const upstashConfigured =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

// Fail open, but never SILENTLY: in production a missing Upstash config removes
// the login/credential-stuffing throttle entirely, so make that loud in the
// Vercel logs rather than degrading invisibly. (We deliberately stay fail-open
// rather than fail-closed so one missing env var can't lock the whole committee
// out of signin — bcrypt still slows attackers in the meantime.)
if (!upstashConfigured && process.env.NODE_ENV === "production") {
  console.error(
    "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN are not set in production — " +
      "login and per-IP rate limiting are DISABLED (fail-open). Set them to re-enable.",
  );
}

// One Redis client, reused across warm invocations. Built only when configured.
const redis = upstashConfigured ? Redis.fromEnv() : null;

/**
 * Per-IP limit for ANONYMOUS traffic on matched routes (almost only /signin
 * and /invite — everything else redirects to sign-in before getting far).
 * Kept tight because legitimate anonymous traffic is low-volume; this is the
 * scripting/credential-probing guard.
 */
const general = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(120, "60 s"),
      prefix: "rl:app:ip",
      analytics: false,
    })
  : null;

/**
 * Per-USER limit for signed-in sessions, keyed by user id. Sized for real
 * dashboard use — a single action fans out into prefetches, server actions and
 * media-proxy calls, so the ceiling is high enough that humans never hit it
 * while still bounding a runaway script on one account. This is the limiter an
 * authed admin draws from instead of sharing the anonymous per-IP bucket.
 */
const perUser = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(1000, "60 s"),
      prefix: "rl:app:user",
      analytics: false,
    })
  : null;

/**
 * Strict limit for the credentials login. Keyed by IP+email so one attacker
 * can't grind a single account and a botnet can't grind one IP either.
 */
const login = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(8, "60 s"),
      prefix: "rl:app:login",
      analytics: false,
    })
  : null;

export type LimitResult = {
  success: boolean;
  /** Unix ms when the window resets — used for the Retry-After header. */
  reset: number;
};

const PASS: LimitResult = { success: true, reset: 0 };

/**
 * Trusted client IP, used as the rate-limit key. `req.ip` was removed in Next 16.
 *
 * SECURITY: only trust headers the platform sets, never ones the caller can
 * forge. On the current topology (Vercel with grey-cloud / DNS-only Cloudflare —
 * see HOSTING.md) Vercel sets `x-real-ip` to the true connecting IP at its edge
 * and overwrites any client value. The *leftmost* `x-forwarded-for` entry and
 * `cf-connecting-ip` are attacker-controllable here, so trusting them would let
 * a rotated header mint a fresh bucket per request and bypass the login throttle.
 * Prefer `x-real-ip`, then the *rightmost* (trusted) XFF hop.
 *
 * If Cloudflare is ever switched to orange-cloud (proxying), re-add
 * `cf-connecting-ip` as the most-trusted source.
 */
export function getClientIp(req: Request): string {
  const real = req.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const hops = fwd.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1]!;
  }
  return "0.0.0.0";
}

/** Per-IP limiter for anonymous traffic. Fails open if Upstash is not configured. */
export async function limitByIp(ip: string): Promise<LimitResult> {
  if (!general) return PASS;
  const { success, reset } = await general.limit(ip);
  return { success, reset };
}

/** Generous per-user limiter for authenticated sessions. Fails open. */
export async function limitByUser(userId: string): Promise<LimitResult> {
  if (!perUser) return PASS;
  const { success, reset } = await perUser.limit(userId);
  return { success, reset };
}

/** Strict limiter for login attempts, keyed by IP + email. Fails open. */
export async function limitLogin(ip: string, email: string): Promise<LimitResult> {
  if (!login) return PASS;
  const { success, reset } = await login.limit(`${ip}:${email}`);
  return { success, reset };
}

/** Build a 429 with a sane Retry-After (seconds) from a reset timestamp. */
export function tooManyRequests(reset: number): Response {
  const retryAfter = reset ? Math.max(1, Math.ceil((reset - dateNow()) / 1000)) : 60;
  return new Response("Too Many Requests", {
    status: 429,
    headers: { "Retry-After": String(retryAfter) },
  });
}

// Indirection so this module has a single, easily-mocked clock reference.
function dateNow(): number {
  return Date.now();
}
