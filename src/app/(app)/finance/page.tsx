import Link from "next/link";

import { BarRow, StatTile } from "@/components/dashboard";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { cn, formatAUD, formatDate } from "@/lib/format";
import { financeStatusVariant } from "@/lib/options";
import { getAllFinance, getEventOptions, type FinanceWithEvent } from "@/lib/queries";
import { canWrite } from "@/lib/rbac";
import { getExpenseBreakdown, getFinanceSummary } from "@/lib/workspace-queries";

import { NewFinanceButton } from "./new-finance-button";

const SETTLED = new Set(["Paid", "Rejected"]);

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {hint && <span className="text-xs text-muted/70">{hint}</span>}
    </div>
  );
}

/** One line of the opening → closing balance waterfall. */
function FlowRow({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
  bold?: boolean;
}) {
  const toneClass = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={cn("tabular-nums", toneClass, bold && "font-semibold")}>{value}</span>
    </div>
  );
}

function Row({ f }: { f: FinanceWithEvent }) {
  return (
    <li>
      <Link
        href={`/finance/${f.id}/edit`}
        className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-elevated/50"
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{f.item}</div>
          <div className="truncate text-xs text-muted">
            {f.type ?? "—"}
            {f.eventName ? ` · ${f.eventName}` : ""}
            {f.dateRequested ? ` · ${formatDate(f.dateRequested)}` : ""}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm tabular-nums">{formatAUD(f.amountAud)}</span>
          <Badge variant={financeStatusVariant(f.status)}>{f.status ?? "—"}</Badge>
        </div>
      </Link>
    </li>
  );
}

export default async function FinancePage() {
  const me = await requireModule("finance");
  const writable = canWrite(me.modules, me.writeModules, "finance");
  const [all, events, summary, expenses] = await Promise.all([
    getAllFinance(),
    getEventOptions(),
    getFinanceSummary(),
    getExpenseBreakdown(),
  ]);
  const report = summary.report;
  const maxExp = Math.max(1, ...expenses.map((e) => e.value));
  const outstanding = all.filter((f) => !SETTLED.has(f.status ?? ""));
  const settled = all.filter((f) => SETTLED.has(f.status ?? ""));
  const outstandingTotal = outstanding.reduce((acc, f) => acc + Number(f.amountAud ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Finance"
        description="Live club balance from DUSA, plus the committee's grant and reimbursement tracker."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Finance" }]}
        action={writable && <NewFinanceButton events={events} />}
      />

      {/* Current finances — actuals from the latest DUSA P&L snapshot. */}
      <section className="mb-10">
        <SectionLabel hint={report?.reportDate ? `DUSA P&L · as at ${formatDate(report.reportDate)}` : "from DUSA P&L"}>
          Current finances
        </SectionLabel>

        {report ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile
                label="Club balance"
                value={formatAUD(report.closingBalance)}
                accent
                sub={report.reportDate ? `as at ${formatDate(report.reportDate)}` : undefined}
              />
              <StatTile label="Income (FY)" value={formatAUD(report.totalIncome)} tone="success" />
              <StatTile label="Expenses (FY)" value={formatAUD(report.totalExpense)} tone="danger" />
              <StatTile
                label="Event budgets"
                value={formatAUD(summary.totalBudget)}
                sub={`${formatAUD(summary.totalGrant)} grants applied`}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard title="Where the money goes">
                <div className="space-y-3 p-5">
                  {expenses.length === 0 ? (
                    <EmptyState>No transactions imported yet.</EmptyState>
                  ) : (
                    expenses.map((e) => (
                      <BarRow
                        key={e.label}
                        label={e.label}
                        value={e.value}
                        max={maxExp}
                        display={formatAUD(e.value)}
                      />
                    ))
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Balance flow">
                <div className="space-y-4 p-5 text-sm">
                  <FlowRow label="Opening balance" value={formatAUD(report.openingBalance)} />
                  <FlowRow label="+ Income" value={formatAUD(report.totalIncome)} tone="success" />
                  <FlowRow label="− Expenses" value={formatAUD(report.totalExpense)} tone="danger" />
                  <div className="border-t border-border pt-3">
                    <FlowRow label="Closing balance" value={formatAUD(report.closingBalance)} bold />
                  </div>
                </div>
              </SectionCard>
            </div>
          </div>
        ) : (
          <Card>
            <EmptyState>
              No DUSA finance report imported yet — the club balance, income and expenses appear
              here once a weekly P&amp;L is ingested.
            </EmptyState>
          </Card>
        )}
      </section>

      {/* Committee-tracked grant / reimbursement requests. */}
      <section>
        <SectionLabel>Requests &amp; reimbursements</SectionLabel>

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard
            label="Outstanding"
            value={formatAUD(outstandingTotal)}
            hint={`${outstanding.length} items`}
          />
          <StatCard label="Settled" value={settled.length} hint="paid / rejected" />
          <StatCard label="Total items" value={all.length} />
        </div>

        {all.length === 0 ? (
          <SectionCard title="Requests">
            <EmptyState>No finance items yet — add the first one.</EmptyState>
          </SectionCard>
        ) : (
          <div className="space-y-6">
            <SectionCard title={`Outstanding · ${formatAUD(outstandingTotal)}`}>
              {outstanding.length === 0 ? (
                <EmptyState>Nothing outstanding.</EmptyState>
              ) : (
                <ul className="divide-y divide-border">
                  {outstanding.map((f) => (
                    <Row key={f.id} f={f} />
                  ))}
                </ul>
              )}
            </SectionCard>
            {settled.length > 0 && (
              <SectionCard title="Settled">
                <ul className="divide-y divide-border">
                  {settled.map((f) => (
                    <Row key={f.id} f={f} />
                  ))}
                </ul>
              </SectionCard>
            )}
          </div>
        )}
      </section>
    </>
  );
}
