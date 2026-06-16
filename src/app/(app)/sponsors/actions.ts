"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { sponsors } from "@/db/schema";
import { sponsorContacts } from "@/db/workspace-schema";
import { apiEnv } from "@/lib/api-env";
import { requireWrite } from "@/lib/dal";
import { bool, int, jsonList, num, str } from "@/lib/form-data";
import { revalidateWebsite } from "@/lib/revalidate-website";
import { archiveToken, createToken, snapshotForDelete, snapshotForUpdate } from "@/lib/undo";
import type { ActionResult } from "@/lib/undo-types";
import { logMutation } from "@/lib/usage";

export type FormState = ActionResult;

function parseSponsor(fd: FormData) {
  return {
    organisation: str(fd, "organisation") ?? "",
    stage: str(fd, "stage"),
    relationshipType: str(fd, "relationship_type"),
    contactPersonId: int(fd, "contact_person_id"),
    tier: str(fd, "tier"),
    valueAud: num(fd, "value_aud"),
    supportTypes: jsonList(fd, "support_types"),
    dusaApproved: bool(fd, "dusa_approved"),
    showOnWebsite: bool(fd, "show_on_website"),
    notes: str(fd, "notes"),
  };
}

async function revalidateSponsors() {
  revalidatePath("/sponsors");
  revalidatePath("/");
  await revalidateWebsite("sponsors");
}

export async function createSponsor(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireWrite("sponsors");
  const values = parseSponsor(fd);
  if (!values.organisation) return { error: "Organisation is required." };
  const [row] = await db.insert(sponsors).values(values).returning({ id: sponsors.id });
  await revalidateSponsors();
  return { ok: true, message: "Sponsor created", undo: createToken("sponsor", row?.id), id: row?.id };
}

export async function updateSponsor(
  id: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  await requireWrite("sponsors");
  const values = parseSponsor(fd);
  if (!values.organisation) return { error: "Organisation is required." };
  const undo = await snapshotForUpdate("sponsor", id);
  await db
    .update(sponsors)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(sponsors.id, id));
  await revalidateSponsors();
  return { ok: true, message: "Sponsor updated", undo };
}

export async function archiveSponsor(id: number): Promise<FormState> {
  await requireWrite("sponsors");
  await db
    .update(sponsors)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(eq(sponsors.id, id));
  await revalidateSponsors();
  return {
    ok: true,
    message: "Sponsor archived",
    undo: archiveToken("sponsor", id),
  };
}

export async function deleteSponsor(id: number): Promise<FormState> {
  await requireWrite("sponsors");
  const undo = await snapshotForDelete("sponsor", id);
  await db.delete(sponsors).where(eq(sponsors.id, id));
  await revalidateSponsors();
  return { ok: true, message: "Sponsor deleted", undo };
}

// --- Sponsor contacts (individual people on a sponsorship) ------------------

export async function addSponsorContact(
  sponsorId: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireWrite("sponsors");
  const personId = int(fd, "person_id");
  const name = str(fd, "name");
  if (!personId && !name) return { error: "Pick a person or type a name." };
  await db.insert(sponsorContacts).values({
    sponsorId,
    personId,
    name,
    role: str(fd, "role"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    notes: str(fd, "notes"),
  });
  await logMutation(user, "create", "sponsor-contact", sponsorId);
  revalidatePath(`/sponsors/${sponsorId}`);
  return { ok: true };
}

export async function deleteSponsorContact(id: number, sponsorId: number): Promise<void> {
  const user = await requireWrite("sponsors");
  await db.delete(sponsorContacts).where(eq(sponsorContacts.id, id));
  await logMutation(user, "delete", "sponsor-contact", id);
  revalidatePath(`/sponsors/${sponsorId}`);
}

// (Per-sponsor quick-add task moved to the shared quickAddRelatedTask — see
// tasks/actions.ts + components/related-tasks.tsx.)

// --- Sponsor documents (PDF/image uploads → dsec-api → Supabase) ------------

export async function uploadSponsorDocument(
  sponsorId: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireWrite("sponsors");
  const env = apiEnv();
  if (!env) {
    return {
      error:
        "File uploads need DSEC_API_URL and a write-scoped DSEC_API_KEY set in the dashboard env.",
    };
  }
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF or image to upload." };
  }

  const out = new FormData();
  out.set("entity_type", "sponsor");
  out.set("entity_id", String(sponsorId));
  out.set("file", file);
  const title = str(fd, "title");
  if (title) out.set("title", title);

  try {
    const res = await fetch(`${env.base}/attachments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.key}` },
      body: out,
    });
    if (!res.ok) {
      const detail = await res.text();
      return { error: `Upload failed (${res.status}): ${detail.slice(0, 200)}` };
    }
  } catch (e) {
    return { error: `Could not reach the API: ${(e as Error).message}` };
  }

  await logMutation(user, "create", "sponsor-document", sponsorId);
  revalidatePath(`/sponsors/${sponsorId}`);
  return { ok: true };
}

export async function deleteSponsorDocument(
  attachmentId: number,
  sponsorId: number,
): Promise<void> {
  const user = await requireWrite("sponsors");
  const env = apiEnv();
  if (env) {
    // Object-level auth: confirm the attachment belongs to THIS sponsor before
    // deleting, since the id is otherwise independent of the sponsorId argument.
    let belongs = false;
    try {
      const res = await fetch(
        `${env.base}/attachments?entity_type=sponsor&entity_id=${sponsorId}`,
        { headers: { Authorization: `Bearer ${env.key}` }, cache: "no-store" },
      );
      if (res.ok) {
        const items = (await res.json()) as Array<{ id: number }>;
        belongs = items.some((a) => a.id === attachmentId);
      }
    } catch {
      belongs = false;
    }
    if (!belongs) {
      revalidatePath(`/sponsors/${sponsorId}`);
      return;
    }
    try {
      await fetch(`${env.base}/attachments/${attachmentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${env.key}` },
      });
    } catch {
      // best-effort — the row may already be gone
    }
  }
  await logMutation(user, "delete", "sponsor-document", attachmentId);
  revalidatePath(`/sponsors/${sponsorId}`);
}
