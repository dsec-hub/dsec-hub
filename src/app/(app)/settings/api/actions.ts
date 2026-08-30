"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/dal";
import { str } from "@/lib/form-data";
import { logMutation } from "@/lib/usage";
import {
  allowedScopesFor,
  type ApiScope,
  mintToken,
  ownerLabel,
  revokeTokenForUser,
} from "@/lib/api-tokens";

const ALL_SCOPES: ApiScope[] = ["read", "write", "trigger", "ingest"];

export type CreateTokenState =
  | { ok: true; rawKey: string; prefix: string; scopes: string[] }
  | { error: string }
  | undefined;

/**
 * Mint a personal API/MCP token for the signed-in user. The requested scopes are
 * validated against what the user's role permits (defense in depth — dsec-api
 * re-checks them against the service key too).
 */
export async function createApiToken(
  _prev: CreateTokenState,
  fd: FormData,
): Promise<CreateTokenState> {
  const user = await requireUser();
  const allowed = new Set(allowedScopesFor(user));
  if (allowed.size === 0) {
    return { error: "Your role doesn't permit creating API tokens. Ask an admin." };
  }

  const name = str(fd, "name");
  if (!name) return { error: "Give the token a name so you can recognise it later." };

  const requested = ALL_SCOPES.filter((s) => fd.get(`scope_${s}`) != null);
  if (requested.length === 0) return { error: "Pick at least one scope." };

  const escalated = requested.filter((s) => !allowed.has(s));
  if (escalated.length > 0) {
    return { error: `Your role can't grant: ${escalated.join(", ")}.` };
  }

  const result = await mintToken(ownerLabel(user.id), name, requested);
  if (!result.ok) return { error: result.error };

  await logMutation(user, "create", "api_token", undefined, `${name} (${result.scopes.join("+")})`);
  revalidatePath("/settings/api");
  return { ok: true, rawKey: result.rawKey, prefix: result.prefix, scopes: result.scopes };
}

export type RevokeTokenState = { error?: string } | undefined;

/**
 * Revoke one of the user's own tokens. `keyId` is bound at the call site; the
 * remaining `(prev, formData)` shape is the `useActionState` contract so the
 * button can surface a failure. A revoke that quietly fails would leave a live
 * credential the user believes is gone, so any failure returns an `error` the
 * client toasts and the token stays listed (still active) so they can retry.
 */
export async function revokeApiToken(
  keyId: number,
  _prev: RevokeTokenState,
  _fd: FormData,
): Promise<RevokeTokenState> {
  const user = await requireUser();
  const result = await revokeTokenForUser(user.id, keyId);
  if (!result.ok) {
    return { error: "Couldn't revoke the token. Please try again; if it persists, tell an admin." };
  }
  await logMutation(user, "update", "api_token", keyId, "revoked");
  revalidatePath("/settings/api");
  return undefined;
}
