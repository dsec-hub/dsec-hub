"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { assistanceRequest, portalAccount } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";

function nowISO() {
  return new Date().toISOString();
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
