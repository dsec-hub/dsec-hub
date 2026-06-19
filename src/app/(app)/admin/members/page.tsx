import { count, desc, eq } from "drizzle-orm";

import {
  Badge,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  buttonDanger,
  buttonGhost,
  buttonPrimary,
} from "@/components/ui";
import { db } from "@/db";
import { assistanceRequest, members, portalAccount } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { cn, formatDate } from "@/lib/format";
import type { BadgeVariant } from "@/lib/options";

import {
  approveAccount,
  approveFromRequest,
  clearOverride,
  dismissRequest,
  rejectAccount,
  resolveRequest,
} from "./actions";

const ACCOUNT_LIMIT = 500;

function statusVariant(status: string): BadgeVariant {
  if (status === "verified") return "success";
  if (status === "trial") return "warning";
  if (status === "lapsed") return "warning";
  return "danger"; // locked | rejected
}

export default async function MemberSupportPage() {
  await requireAdmin();

  const [requests, accounts, statusCounts, openReqRows] = await Promise.all([
    db
      .select({
        id: assistanceRequest.id,
        email: assistanceRequest.email,
        contactEmail: assistanceRequest.contactEmail,
        studentId: assistanceRequest.studentId,
        category: assistanceRequest.category,
        message: assistanceRequest.message,
        createdAt: assistanceRequest.createdAt,
        accountId: assistanceRequest.portalAccountId,
        accountStatus: portalAccount.status,
      })
      .from(assistanceRequest)
      .leftJoin(portalAccount, eq(assistanceRequest.portalAccountId, portalAccount.id))
      .where(eq(assistanceRequest.status, "open"))
      .orderBy(desc(assistanceRequest.createdAt))
      .limit(100),
    db
      .select({
        id: portalAccount.id,
        email: portalAccount.email,
        name: portalAccount.name,
        status: portalAccount.status,
        provider: portalAccount.provider,
        trialExpiresAt: portalAccount.trialExpiresAt,
        verifiedAt: portalAccount.verifiedAt,
        manualOverride: portalAccount.manualOverride,
        overrideBy: portalAccount.overrideBy,
        createdAt: portalAccount.createdAt,
        memberName: members.fullName,
        memberEndDate: members.endDate,
      })
      .from(portalAccount)
      .leftJoin(members, eq(portalAccount.memberId, members.id))
      .orderBy(desc(portalAccount.createdAt))
      .limit(ACCOUNT_LIMIT),
    // Exact headline counts — independent of the list caps above, so the stats
    // never silently undercount once the lists are truncated.
    db.select({ status: portalAccount.status, n: count() }).from(portalAccount).groupBy(portalAccount.status),
    db.select({ n: count() }).from(assistanceRequest).where(eq(assistanceRequest.status, "open")),
  ]);

  const byStatus: Record<string, number> = Object.fromEntries(
    statusCounts.map((r) => [r.status ?? "unknown", r.n]),
  );
  const verifiedN = byStatus.verified ?? 0;
  const trialN = byStatus.trial ?? 0;
  const lapsedN = byStatus.lapsed ?? 0; // grace window — these members STILL have access
  const lockedN = (byStatus.locked ?? 0) + (byStatus.rejected ?? 0);
  const openReqN = openReqRows[0]?.n ?? 0;

  return (
    <>
      <PageHeader
        title="Member Support"
        description="Portal members who couldn't be auto-verified against the DUSA roster, and their help requests. Approving sets a manual override that grants access."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Open requests" value={openReqN} />
        <StatCard label="Verified" value={verifiedN} />
        <StatCard label="On trial" value={trialN} />
        <StatCard label="Lapsed (grace)" value={lapsedN} hint="still has access" />
        <StatCard label="Locked / rejected" value={lockedN} />
      </div>

      {/* Assistance requests ----------------------------------------------- */}
      <SectionCard title={`Open assistance requests · ${openReqN}`} className="mb-6">
        {requests.length === 0 ? (
          <EmptyState>No open requests — members can verify themselves automatically.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {r.email}
                    <Badge variant="neutral">{r.category}</Badge>
                    {r.accountStatus && <Badge variant={statusVariant(r.accountStatus)}>{r.accountStatus}</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {r.contactEmail ? `DUSA email: ${r.contactEmail} · ` : ""}
                    {r.studentId ? `Student ID: ${r.studentId} · ` : ""}
                    {formatDate(r.createdAt)}
                  </div>
                  <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm text-foreground/80">{r.message}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {r.accountId != null && (
                    <form action={approveFromRequest.bind(null, r.id)}>
                      <button className={buttonPrimary}>Approve &amp; resolve</button>
                    </form>
                  )}
                  <form action={resolveRequest.bind(null, r.id)}>
                    <button className={buttonGhost}>Resolve</button>
                  </form>
                  <form action={dismissRequest.bind(null, r.id)}>
                    <button className={cn(buttonGhost, "text-danger hover:text-danger")}>Dismiss</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        {requests.length < openReqN && (
          <p className="border-t border-border px-5 py-3 text-xs text-muted">
            Showing the {requests.length} most recent of {openReqN} open requests.
          </p>
        )}
      </SectionCard>

      {/* Portal accounts --------------------------------------------------- */}
      <SectionCard
        title={`Portal accounts · ${accounts.length}${accounts.length >= ACCOUNT_LIMIT ? "+" : ""}`}
      >
        {accounts.length === 0 ? (
          <EmptyState>No one has signed in to the member portal yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {accounts.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 truncate text-sm font-medium">
                    {a.name ? `${a.name} · ${a.email}` : a.email}
                    <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                    {a.manualOverride && (
                      <Badge variant={a.manualOverride === "approved" ? "accent" : "danger"}>
                        override: {a.manualOverride}
                      </Badge>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {a.provider ? `${a.provider} · ` : ""}
                    {a.memberName ? `roster: ${a.memberName}${a.memberEndDate ? ` (through ${formatDate(a.memberEndDate)})` : ""} · ` : ""}
                    {a.status === "trial" ? `trial ends ${formatDate(a.trialExpiresAt)} · ` : ""}
                    joined {formatDate(a.createdAt)}
                    {a.overrideBy ? ` · by ${a.overrideBy}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {a.manualOverride ? (
                    <form action={clearOverride.bind(null, a.id)}>
                      <button className={buttonGhost}>Clear override</button>
                    </form>
                  ) : (
                    <>
                      <form action={approveAccount.bind(null, a.id)}>
                        <button className={buttonGhost}>Approve</button>
                      </form>
                      <form action={rejectAccount.bind(null, a.id)}>
                        <button className={cn(buttonGhost, "text-danger hover:text-danger")}>Reject</button>
                      </form>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
