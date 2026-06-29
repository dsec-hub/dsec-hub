"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { documents } from "@/db/workspace-schema";
import { apiEnv } from "@/lib/api-env";
import { requireWrite, type CurrentUser } from "@/lib/dal";
import { committeeScopeOf } from "@/lib/scope";
import { canWriteCommittee } from "@/lib/rbac";
import { bool, int, str } from "@/lib/form-data";
import { parsePageDoc, type ImageRef } from "@/lib/page-blocks";
import { revalidateWebsite } from "@/lib/revalidate-website";
import { snapshotForUpdate } from "@/lib/undo";
import type { ActionResult } from "@/lib/undo-types";
import { logMutation } from "@/lib/usage";

export type FormState = { error?: string; ok?: boolean } | undefined;
export type DocumentRow = typeof documents.$inferSelect;

/** What the inline page-image upload returns: the stored image, or an error. */
export type PageImageResult = { image: ImageRef } | { error: string };

/** Website top-level routes a page slug must never shadow (mirrors the reserved
 * list in PAGES-SPEC.md). Treated as already-taken by ensureUniqueSlug so a page
 * can't collide with a real section. */
const RESERVED_SLUGS = new Set([
  "about", "api", "contact", "events", "heroes", "join", "links", "projects",
  "scan", "sponsor", "team", "pages", "preview", "p",
]);

/** Lowercase, non-alphanumerics -> "-", trim leading/trailing "-". Mirrors the
 * project/event slugify so a generated page slug matches the website's. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A page slug that's unique across documents (and not a reserved website
 * route), appending -2, -3… on collision. `excludeId` skips the doc itself so a
 * re-publish keeps its own slug. */
async function ensureUniqueSlug(base: string, excludeId?: number): Promise<string> {
  const root = slugify(base) || "page";
  const taken = new Set(RESERVED_SLUGS);
  const rows = await db.select({ slug: documents.slug, id: documents.id }).from(documents);
  for (const r of rows) {
    if (r.slug && r.id !== excludeId) taken.add(r.slug);
  }
  if (!taken.has(root)) return root;
  for (let n = 2; ; n++) {
    const candidate = `${root}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Tolerant JSON.parse — a corrupt string yields null (→ empty page). */
function safeParse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

type PageFields = {
  slug: string | null;
  navLabel: string | null;
  showInNav: boolean;
  navArea: string | null;
  navOrder: number;
  seoDescription: string | null;
  coverImageUrl: string | null;
  contentJson?: unknown;
};

/**
 * Page-publishing columns, read off the same edit form. `content_json` is only
 * applied when the editor actually submitted it (the panel renders for Page
 * docs), so editing a non-page doc never clobbers a stored body. The is_public
 * flag is deliberately NOT read here — it's owned by setDocumentPublished (the
 * Publish button) so saving content never silently (un)publishes a page.
 */
function parsePageFields(fd: FormData): PageFields {
  const fields: PageFields = {
    slug: str(fd, "slug"),
    navLabel: str(fd, "nav_label"),
    showInNav: bool(fd, "show_in_nav"),
    navArea: str(fd, "nav_area"),
    navOrder: int(fd, "nav_order") ?? 0,
    seoDescription: str(fd, "seo_description"),
    coverImageUrl: str(fd, "cover_image_url"),
  };
  if (fd.get("content_json") != null) {
    fields.contentJson = parsePageDoc(safeParse(str(fd, "content_json")));
  }
  return fields;
}

function parseDocument(fd: FormData) {
  return {
    title: str(fd, "title") ?? "",
    type: str(fd, "type"),
    committee: str(fd, "committee"),
    status: str(fd, "status"),
    content: str(fd, "content"),
    assigneeId: int(fd, "assignee_id"),
    relatedEventId: int(fd, "related_event_id"),
    relatedProjectId: int(fd, "related_project_id"),
    relatedMeetingId: int(fd, "related_meeting_id"),
    relatedTaskId: int(fd, "related_task_id"),
    ...parsePageFields(fd),
  };
}

/** "all"-scope users save the submitted committee (or club-wide); "own"-scope
 * users are forced to their own committee — never club-wide or another team's. */
function resolveDocCommittee(user: CurrentUser, submitted: string | null): string | null {
  const { all, committee } = committeeScopeOf(user);
  return all ? submitted || null : committee;
}

/** Bounce if the user can't write a doc owned by this committee (scoped guard). */
async function assertCanWriteDoc(user: CurrentUser, id: number): Promise<void> {
  const [existing] = await db
    .select({ committee: documents.committee })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  if (existing && !canWriteCommittee(user.viewConfig.committeeScope, user.userCommittee, existing.committee)) {
    redirect("/docs");
  }
}

async function revalidateDocs() {
  revalidatePath("/docs");
  revalidatePath("/dashboard");
  // A published page is served off the website's /[slug] route + page feeds.
  await revalidateWebsite("pages");
}

export async function createDocument(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireWrite("documents");
  const values = parseDocument(fd);
  if (!values.title) return { error: "Title is required." };
  values.committee = resolveDocCommittee(user, values.committee ?? null);
  // Normalise a hand-typed page slug (lowercase/hyphenate, dodge reserved routes
  // + collisions) so a page can never be published to an unreachable URL.
  if (values.slug) values.slug = await ensureUniqueSlug(String(values.slug));
  const [row] = await db
    .insert(documents)
    .values(values)
    .returning({ id: documents.id });
  await logMutation(user, "create", "document", row?.id);
  await revalidateDocs();
  redirect("/docs");
}

export async function updateDocument(
  id: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireWrite("documents");
  await assertCanWriteDoc(user, id);
  const values = parseDocument(fd);
  if (!values.title) return { error: "Title is required." };
  values.committee = resolveDocCommittee(user, values.committee ?? null);
  // Normalise a hand-typed page slug, keeping this doc's own slug on re-save.
  if (values.slug) values.slug = await ensureUniqueSlug(String(values.slug), id);
  await db
    .update(documents)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(documents.id, id));
  await logMutation(user, "update", "document", id);
  await revalidateDocs();
  redirect("/docs");
}

export async function archiveDocument(id: number): Promise<void> {
  const user = await requireWrite("documents");
  await assertCanWriteDoc(user, id);
  await db
    .update(documents)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(eq(documents.id, id));
  await logMutation(user, "archive", "document", id);
  await revalidateDocs();
  redirect("/docs");
}

export async function deleteDocument(id: number): Promise<void> {
  const user = await requireWrite("documents");
  await assertCanWriteDoc(user, id);
  await db.delete(documents).where(eq(documents.id, id));
  await logMutation(user, "delete", "document", id);
  await revalidateDocs();
  redirect("/docs");
}

/**
 * Toggle a document between draft and published-as-a-page. Publishing
 * (is_public=true) reveals it at dsec.club/<slug>; a draft stays in the
 * dashboard only. A page needs a title, and is given a unique slug on first
 * publish (kept on later re-publishes). Mirrors projects' setProjectPublished —
 * reversible via undo, never redirects (the Publish button just refreshes).
 */
export async function setDocumentPublished(
  id: number,
  published: boolean,
): Promise<ActionResult> {
  const user = await requireWrite("documents");
  await assertCanWriteDoc(user, id);

  // Generate (and persist) a slug on publish when one isn't set yet.
  let newSlug: string | undefined;
  if (published) {
    const [d] = await db
      .select({ title: documents.title, slug: documents.slug })
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    if (!d) return { error: "Document not found." };
    if (!d.title) return { error: "Add a title before publishing." };
    if (!d.slug) newSlug = await ensureUniqueSlug(d.title, id);
  }

  const undo = await snapshotForUpdate("document", id);
  await db
    .update(documents)
    .set({
      isPublic: published,
      ...(newSlug ? { slug: newSlug } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(documents.id, id));
  await logMutation(user, "update", "document", id);
  revalidatePath("/docs");
  revalidatePath(`/docs/${id}`);
  revalidatePath(`/docs/${id}/edit`);
  revalidatePath("/dashboard");
  await revalidateWebsite("pages");
  return { ok: true, message: published ? "Page published" : "Moved to draft", undo };
}

/**
 * Upload one already-selected page image to dsec-api `POST /media` with
 * entity_type="document", returning an ImageRef the editor writes straight into
 * the block JSON. The block body (with this URL) is persisted on the next form
 * save. References media/actions.ts uploadMedia for the multipart forwarding.
 */
export async function uploadPageImage(
  docId: number,
  formData: FormData,
): Promise<PageImageResult> {
  const user = await requireWrite("documents");
  await assertCanWriteDoc(user, docId);

  const env = apiEnv();
  if (!env) {
    return {
      error:
        "Image upload needs DSEC_API_URL and a write-scoped DSEC_API_KEY set in the dashboard env.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No image to upload." };

  // Re-pack so we control exactly which fields reach the API.
  const body = new FormData();
  body.set("entity_type", "document");
  body.set("entity_id", String(docId));
  body.set("role", String(formData.get("role") || "image"));
  const alt = formData.get("alt_text");
  if (alt) body.set("alt_text", String(alt));
  body.set("file", file, file.name || "page-image.webp");

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
    const m = (await res.json()) as {
      id: number;
      webp_url: string;
      png_url?: string | null;
      width?: number | null;
      height?: number | null;
    };
    await logMutation(user, "create", "document-media", docId);
    const image: ImageRef = {
      mediaId: m.id,
      webp: m.webp_url,
      png: m.png_url ?? undefined,
      width: m.width ?? undefined,
      height: m.height ?? undefined,
      alt: alt ? String(alt) : undefined,
    };
    return { image };
  } catch (e) {
    return { error: `Could not reach the API: ${(e as Error).message}` };
  }
}
