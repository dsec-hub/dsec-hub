import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { apiKey } from "@/db/schema";
import { apiEnv } from "@/lib/api-env";
import type { CurrentUser } from "@/lib/dal";
import { canWrite, isAdmin } from "@/lib/rbac";

/**
 * Self-service MCP / API tokens.
 *
 * API-key scopes are coarse and GLOBAL — they are not per-module. A `write`
 * token can write every module via MCP, a `read` token can read every module.
 * We therefore map the dashboard's module RBAC onto the closest scope a user's
 * role can justify (see `allowedScopesFor`) and surface the caveat in the UI.
 *
 * Key generation + argon2 hashing live in dsec-api (the schema owner); minting
 * goes through its `POST /admin/keys/self` endpoint, which re-checks that the
 * requested scopes are a subset of the service key's own scopes. Listing and
 * revoking read/write the `api_key` table directly (no hashing involved), scoped
 * to the user via `created_by`.
 */

export type ApiScope = "read" | "write" | "trigger" | "ingest";

export const API_SCOPES: { key: ApiScope; label: string; description: string }[] = [
  {
    key: "read",
    label: "Read",
    description: "View everything — members, finances, events, projects, tasks, docs, sponsors.",
  },
  {
    key: "write",
    label: "Write",
    description: "Create & update events, projects, tasks, docs, sponsors, people, and partners.",
  },
  {
    key: "trigger",
    label: "AI",
    description: "Run AI features such as generating meeting notes from a transcript.",
  },
  {
    key: "ingest",
    label: "Ingest",
    description: "Import the weekly DUSA membership / P&L spreadsheets.",
  },
];

/** The opaque owner label stored on `api_key.created_by`, used to scope a user's
 * own tokens (distinct from admin-minted keys, whose created_by is a username). */
export function ownerLabel(userId: number): string {
  return `appuser:${userId}`;
}

/**
 * The scopes a user MAY mint, bounded by their dashboard role:
 *  - read:    can view any module
 *  - write:   can edit any module
 *  - trigger: can edit Meetings (the AI meeting-notes surface)
 *  - ingest:  admin only (the DUSA import path)
 * Admins (superusers) get all four.
 */
export function allowedScopesFor(user: CurrentUser): ApiScope[] {
  const admin = isAdmin(user.modules);
  const out: ApiScope[] = [];
  if (admin || user.modules.length > 0) out.push("read");
  if (admin || user.writeModules.length > 0) out.push("write");
  if (admin || canWrite(user.modules, user.writeModules, "meetings")) out.push("trigger");
  if (admin) out.push("ingest");
  return out;
}

export type ApiTokenRow = {
  id: number;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
};

/** A user's own API tokens (newest first), active and revoked. */
export async function listTokensForUser(userId: number): Promise<ApiTokenRow[]> {
  const rows = await db
    .select({
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt,
      lastUsedAt: apiKey.lastUsedAt,
      revoked: apiKey.revoked,
    })
    .from(apiKey)
    .where(eq(apiKey.createdBy, ownerLabel(userId)))
    .orderBy(desc(apiKey.createdAt));
  return rows.map((r) => ({
    ...r,
    scopes: Array.isArray(r.scopes) ? (r.scopes as string[]) : [],
  }));
}

export type MintResult =
  | { ok: true; rawKey: string; prefix: string; scopes: string[] }
  | { ok: false; error: string };

/** Mint a key via dsec-api (the schema owner — it generates + argon2-hashes the
 * key and returns the raw value exactly once). */
export async function mintToken(
  owner: string,
  name: string,
  scopes: ApiScope[],
): Promise<MintResult> {
  const env = apiEnv();
  if (!env) {
    return { ok: false, error: "API tokens need DSEC_API_URL + DSEC_API_KEY set on the server." };
  }
  let res: Response;
  try {
    res = await fetch(`${env.base}/admin/keys/self`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${env.key}` },
      body: JSON.stringify({ name, scopes, owner }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Couldn't reach the DSEC API to mint the token." };
  }
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { detail?: string } | null;
    return { ok: false, error: detail?.detail ?? `Mint failed (${res.status}).` };
  }
  const body = (await res.json()) as { raw_key: string; prefix: string; scopes: string[] };
  return { ok: true, rawKey: body.raw_key, prefix: body.prefix, scopes: body.scopes };
}

/** Revoke one of the user's own tokens (ownership-checked). Returns false if the
 * token isn't theirs or doesn't exist. */
export async function revokeTokenForUser(userId: number, keyId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: apiKey.id })
    .from(apiKey)
    .where(and(eq(apiKey.id, keyId), eq(apiKey.createdBy, ownerLabel(userId))))
    .limit(1);
  if (!row) return false;
  await db.update(apiKey).set({ revoked: true }).where(eq(apiKey.id, keyId));
  return true;
}

/** The MCP server URL a client connects to (derived from the API base). */
export function mcpServerUrl(): string {
  const env = apiEnv();
  return env ? `${env.base}/mcp` : "https://api.dsec.club/mcp";
}

/**
 * Fetch the per-scope `llm.md` guide from dsec-api (the schema/tool owner, so
 * the doc can never drift from the real tools). The guide is an instruction
 * sheet for an AI assistant and contains no secret — the key is a placeholder —
 * so the endpoint is public; we just proxy it through the app for download.
 * Returns null if the API isn't configured or is unreachable.
 */
export async function fetchLlmGuide(
  scopes: ApiScope[],
  label?: string,
): Promise<string | null> {
  const env = apiEnv();
  if (!env || scopes.length === 0) return null;
  const params = new URLSearchParams({ scopes: scopes.join(",") });
  if (label) params.set("label", label);
  try {
    const res = await fetch(`${env.base}/mcp-setup/llm?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
