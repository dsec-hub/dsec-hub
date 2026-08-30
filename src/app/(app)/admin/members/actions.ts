"use server";

import { revalidatePath } from "next/cache";
import { asc, desc, eq, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { assistanceRequest, members, portalAccount } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";

function nowISO() {
  return new Date().toISOString();
}

/** A roster candidate the committee can link a portal account to. `isCurrent`
 * is surfaced because linking to a not-current member produces a card the door
 * scanner rejects (NEW-APPDEEP-02) — the picker must warn before that. */
export type RosterCandidate = {
  id: number;
  fullName: string | null;
  studentId: string;
  email: string | null;
  isCurrent: boolean;
};

/**
 * Search the DUSA roster by name or student id, for manually linking an account
 * whose email never matched (NEW-APPDEEP-01). Current members first.
 */
export async function searchRosterMembers(query: string): Promise<RosterCandidate[]> {
  await requireAdmin();
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  return db
    .select({
      id: members.id,
      fullName: members.fullName,
      studentId: members.studentId,
      email: members.email,
      isCurrent: members.isCurrent,
    })
    .from(members)
    .where(
      or(
        sql`lower(${members.fullName}) like ${like}`,
        sql`lower(${members.studentId}) like ${like}`,
      ),
    )
    .orderBy(desc(members.isCurrent), asc(members.fullName))
    .limit(10);
}

/**
 * Link a portal account to its roster record by writing `portal_account.member_id`
 * — the id dsec-api keys the membership card + QR to. A manually-approved account
 * never gets this from the automatic roster match, so without it the member sees
 * a card that loads forever (NEW-APPDEEP-01). Records the admin in `overrideBy`.
 * No migration: the column already exists and is simply never written elsewhere.
 */
export async function linkAccountToMember(accountId: number, memberId: number): Promise<void> {
  const admin = await requireAdmin();
  await db
    .update(portalAccount)
    .set({ memberId, overrideBy: admin.email, updatedAt: nowISO() })
    .where(eq(portalAccount.id, accountId));
  revalidatePath("/admin/members");
}

/**
 * Member Support actions. Approving/rejecting sets `portal_account.manual_override`,
 * which the portal's membership state machine treats as final (wins over the
 * automatic DUSA-roster check). The portal recomputes its own `status` snapshot
 * on the member's next request; we set a sensible one here too so this view
 * reads correctly immediately.
 */

export async function approveAccount(id: number): Promise<void> {
  const admin = await requireAdmin();
  await db
    .update(portalAccount)
    .set({ manualOverride: "approved", overrideBy: admin.email, status: "verified", updatedAt: nowISO() })
    .where(eq(portalAccount.id, id));
  revalidatePath("/admin/members");
}

export async function rejectAccount(id: number): Promise<void> {
  const admin = await requireAdmin();
  await db
    .update(portalAccount)
    .set({ manualOverride: "rejected", overrideBy: admin.email, status: "rejected", updatedAt: nowISO() })
    .where(eq(portalAccount.id, id));
  revalidatePath("/admin/members");
}

/** Drop a manual decision and return the account to automatic roster resolution. */
export async function clearOverride(id: number): Promise<void> {
  await requireAdmin();
  await db
    .update(portalAccount)
    .set({ manualOverride: null, overrideBy: null, overrideNote: null, updatedAt: nowISO() })
    .where(eq(portalAccount.id, id));
  revalidatePath("/admin/members");
}

export async function resolveRequest(id: number): Promise<void> {
  const admin = await requireAdmin();
  await db
    .update(assistanceRequest)
    .set({ status: "resolved", resolvedBy: admin.email, resolvedAt: nowISO(), updatedAt: nowISO() })
    .where(eq(assistanceRequest.id, id));
  revalidatePath("/admin/members");
}

export async function dismissRequest(id: number): Promise<void> {
  const admin = await requireAdmin();
  await db
    .update(assistanceRequest)
    .set({ status: "dismissed", resolvedBy: admin.email, resolvedAt: nowISO(), updatedAt: nowISO() })
    .where(eq(assistanceRequest.id, id));
  revalidatePath("/admin/members");
}

/**
 * The common one-click dev flow: approve the member who raised this request AND
 * mark the request resolved. Falls back to just resolving if the request has no
 * linked account (e.g. the account was deleted).
 */
export async function approveFromRequest(requestId: number): Promise<void> {
  const admin = await requireAdmin();
  const [req] = await db
    .select({ accountId: assistanceRequest.portalAccountId })
    .from(assistanceRequest)
    .where(eq(assistanceRequest.id, requestId))
    .limit(1);

  if (req?.accountId != null) {
    await db
      .update(portalAccount)
      .set({ manualOverride: "approved", overrideBy: admin.email, status: "verified", updatedAt: nowISO() })
      .where(eq(portalAccount.id, req.accountId));
  }
  await db
    .update(assistanceRequest)
    .set({ status: "resolved", resolvedBy: admin.email, resolvedAt: nowISO(), updatedAt: nowISO() })
    .where(eq(assistanceRequest.id, requestId));
  revalidatePath("/admin/members");
}
