"use server";

import { revalidatePath } from "next/cache";

import { apiEnv } from "@/lib/api-env";
import { requireWrite } from "@/lib/dal";
import { revalidateWebsite } from "@/lib/revalidate-website";
import { logMutation } from "@/lib/usage";
import { getMedia } from "@/lib/workspace-queries";

export type MediaState = { error?: string; ok?: string } | undefined;

type EntityType = "event" | "project" | "sponsor" | "speaker" | "person" | "partner";

// Maps an upload target to the dashboard module (for write-permission checks),
// the route base to revalidate, and the public-website feed tag to invalidate.
// Sponsor logos live under /sponsors; speaker photos are managed on the event
// edit page (so they use the events module and the "events" feed); person
// profile photos are managed on the people edit page (the "team" feed).
const SECTION = {
  event: { module: "events", base: "/events", tag: "events" },
  project: { module: "projects", base: "/projects", tag: "projects" },
  sponsor: { module: "sponsors", base: "/sponsors", tag: "sponsors" },
  // Partners are internal-only — "partners" isn't a real website feed tag, so
  // the revalidate ping is a harmless best-effort no-op.
  partner: { module: "partners", base: "/partners", tag: "partners" },
  speaker: { module: "events", base: "/events", tag: "events" },
  person: { module: "people", base: "/people", tag: "team" },
} as const;

/**
 * Confirm media `id` actually belongs to (entityType, entityId).
 *
 * The delete/management actions authorize on the *client-supplied* entityType
 * (which selects the module for requireWrite) but act on an `id` that is
 * independent of it. Without this check a user with write to one media module
 * could delete another module's media by passing a mismatched entityType + the
 * other module's id. Listing the claimed entity's media and checking membership
 * re-binds the id to the entity, so requireWrite(entityType's module) is sound.
 *
 * Checked straight against Neon (the same source the edit page lists from) — not
 * the API's GET /media, which needs the `read` scope. The dashboard's API key is
 * only ever provisioned for `write` (upload + delete), so an API read here would
 * 403 and make every delete fail with "doesn't belong to this item".
 */
async function mediaBelongsTo(
  entityType: EntityType,
  entityId: number,
  id: number,
): Promise<boolean> {
  const items = await getMedia(entityType, entityId);
  return items.some((m) => m.id === id);
}

/**
 * Upload one already-cropped image for an event/project. The dsec-api `/media`
 * endpoint (write scope) compresses it to WebP + PNG and stores it in Supabase;
 * we only forward the multipart body. Image processing never runs in the app.
 *
 * Bound to a form via `useActionState`, so it takes (prevState, formData).
 */
export async function uploadMedia(
  _prev: MediaState,
  formData: FormData,
): Promise<MediaState> {
  const entityType = String(formData.get("entity_type") || "") as EntityType;
  const entityId = Number(formData.get("entity_id"));
  const section = SECTION[entityType];
  if (!section || Number.isNaN(entityId)) return { error: "Invalid upload target." };

  const user = await requireWrite(section.module);

  const env = apiEnv();
  if (!env) {
    return {
      error:
        "Image upload needs DSEC_API_URL and a write-scoped DSEC_API_KEY set in the dashboard env.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No image to upload." };

  // Re-pack the form so we control exactly which fields reach the API.
  const body = new FormData();
  body.set("entity_type", entityType);
  body.set("entity_id", String(entityId));
  body.set("role", String(formData.get("role") || "image"));
  const alt = formData.get("alt_text");
  if (alt) body.set("alt_text", String(alt));
  body.set("file", file, file.name || "upload.png");

  try {
    const res = await fetch(`${env.base}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.key}` },
      body,
    });
    if (!res.ok) {
      const detail = await res.text();
      return { error: `Upload failed (${res.status}): ${detail.slice(0, 200)}` };
    }
    await logMutation(user, "create", `${entityType}-media`, entityId);
    revalidatePath(`${section.base}/${entityId}/edit`);
    revalidatePath(section.base);
    await revalidateWebsite(section.tag);
    return { ok: "Image uploaded." };
  } catch (e) {
    return { error: `Could not reach the API: ${(e as Error).message}` };
  }
}

/** Delete one media asset (removes the Supabase objects + the row). */
export async function deleteMedia(
  id: number,
  entityType: EntityType,
  entityId: number,
): Promise<MediaState> {
  const section = SECTION[entityType];
  if (!section) return { error: "Invalid target." };
  const user = await requireWrite(section.module);

  const env = apiEnv();
  if (!env) return { error: "Image management needs DSEC_API_URL + DSEC_API_KEY." };

  try {
    // Object-level auth: ensure the asset really belongs to the claimed entity
    // before deleting (requireWrite only gated the claimed entityType's module).
    if (!(await mediaBelongsTo(entityType, entityId, id))) {
      return { error: "That image doesn't belong to this item." };
    }

    const res = await fetch(`${env.base}/media/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${env.key}` },
    });
    if (!res.ok && res.status !== 404) {
      const detail = await res.text();
      return { error: `Delete failed (${res.status}): ${detail.slice(0, 200)}` };
    }
    await logMutation(user, "delete", `${entityType}-media`, id);
    revalidatePath(`${section.base}/${entityId}/edit`);
    revalidatePath(section.base);
    await revalidateWebsite(section.tag);
    return { ok: "Image removed." };
  } catch (e) {
    return { error: `Could not reach the API: ${(e as Error).message}` };
  }
}
