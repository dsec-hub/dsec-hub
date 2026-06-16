import Link from "next/link";

import { BarRow, ListRow, Segments, Sparkline, StatTile, ViewTabs } from "@/components/dashboard";
import { Badge, EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { formatAUD, formatDate } from "@/lib/format";
import { canAccess, canWrite } from "@/lib/rbac";
import {
  getExpenseBreakdown,
  getEventBudgets,
  getEventOptions,
  getFacultyBreakdown,
  getFinanceSummary,
  getMemberStats,
  getOpenActionItems,
  getSponsorPipeline,
  getTaskStats,
  getTasksDueSoon,
  getUpcomingEvents,
} from "@/lib/workspace-queries";

import { setEventBudget } from "./budget-actions";
import { BudgetForm } from "./budget-form";

const VIEWS = [
  { key: "command", label: "Command Center" },
  { key: "operations", label: "Operations" },
  { key: "growth", label: "Growth" },
  { key: "money", label: "Finance" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireUser();
  const canFinance = canAccess(user.modules, "finance");
  const canWriteFinance = canWrite(user.modules, user.writeModules, "finance");
  const { view: rawView } = await searchParams;
  const view = (VIEWS.some((v) => v.key === rawView) ? rawView : "command") as ViewKey;

  const tabs = VIEWS.map((v) => ({ key: v.key, label: v.label, href: `/dashboard?view=${v.key}` }));
  const labels: Record<ViewKey, { title: string; desc: string }> = {
    command: { title: "Command Center", desc: "Everything that matters, at a glance." },
    operations: { title: "Operations", desc: "What needs doing — tasks, deadlines, and follow-ups." },
    growth: { title: "Growth", desc: "Membership numbers and weekly momentum." },
    money: { title: "Finance", desc: "Balance, budgets, and where the money goes." },
  };

  return (
    <>
      <PageHeader title={labels[view].title} description={labels[view].desc} />
      <ViewTabs tabs={tabs} active={view} />
      {view === "command" && <CommandView />}
      {view === "operations" && <OperationsView />}
      {view === "growth" && <GrowthView />}
      {view === "money" && <MoneyView canFinance={canFinance} canWriteFinance={canWriteFinance} />}
    </>
  );
}

/* ── Command Center ─────────────────────────────────────────────────────── */

async function CommandView() {
  const [members, finance, taskStats, events, dueSoon, actions] = await Promise.all([
    getMemberStats(),
    getFinanceSummary(),
    getTaskStats(),
    getUpcomingEvents(5),
    getTasksDueSoon(14, 6),
    getOpenActionItems(6),
  ]);
  const closing = finance.report?.closingBalance;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Current members" value={members.current} accent sub={`${members.dusa} DUSA · ${members.nonDusa} non-DUSA`} />
        <StatTile label="Club balance" value={formatAUD(closing)} sub={finance.report?.reportDate ? `as at ${formatDate(finance.report.reportDate)}` : "no report yet"} />
        <StatTile label="Open tasks" value={taskStats.open} tone={taskStats.overdue > 0 ? "warning" : undefined} sub={`${taskStats.overdue} overdue`} />
        <StatTile label="Upcoming events" value={events.length} sub={events[0] ? `next: ${formatDate(events[0].startDate)}` : "none scheduled"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Membership" action={<Link href="/dashboard?view=growth" className="text-xs text-muted hover:text-foreground">Growth →</Link>}>
          <div className="p-5">
            <Sparkline data={members.trend.map((t) => t.totalMembers)} className="h-12" />
            <div className="mt-4">
              <Segments segments={[
                { label: "DUSA", value: members.dusa, tone: "accent" },
                { label: "Non-DUSA", value: members.nonDusa, tone: "muted" },
              ]} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Upcoming events" action={<Link href="/events" className="text-xs text-muted hover:text-foreground">All →</Link>}>
          {events.length === 0 ? <EmptyState>Nothing scheduled.</EmptyState> : (
            <ul className="divide-y divide-border">
              {events.map((e) => (
                <ListRow key={e.id} href={`/events/${e.id}`}
                  left={<><div className="truncate text-sm font-medium">{e.name}</div><div className="mt-0.5 text-xs text-muted">{formatDate(e.startDate)} · {e.venue ?? "—"}</div></>}
                  right={<Badge variant="neutral">{e.status ?? "—"}</Badge>} />
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Tasks due soon" action={<Link href="/tasks" className="text-xs text-muted hover:text-foreground">Board →</Link>}>
          {dueSoon.length === 0 ? <EmptyState>Nothing due in the next two weeks.</EmptyState> : (
            <ul className="divide-y divide-border">
              {dueSoon.map((t) => (
                <ListRow key={t.id}
                  left={<><div className="truncate text-sm">{t.title}</div><div className="mt-0.5 text-xs text-muted">{t.assigneeName ?? "Unassigned"} · {t.committee ?? "—"}</div></>}
                  right={<span className="text-xs tabular-nums text-muted">{formatDate(t.dueDate)}</span>} />
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Open action items">
          {actions.length === 0 ? <EmptyState>No action items from recent meetings.</EmptyState> : (
            <ul className="divide-y divide-border">
              {actions.map((a, i) => (
                <li key={i} className="px-5 py-3">
                  <div className="text-sm">{a.text}</div>
                  <div className="mt-0.5 text-xs text-muted">{a.owner ?? "Unassigned"}{a.due ? ` · due ${a.due}` : ""} · {a.meeting}</div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

/* ── Operations ─────────────────────────────────────────────────────────── */

async function OperationsView() {
  const [taskStats, dueSoon, actions, events, sponsors] = await Promise.all([
    getTaskStats(),
    getTasksDueSoon(14, 12),
    getOpenActionItems(8),
    getUpcomingEvents(5),
    getSponsorPipeline(),
  ]);
  const nextActions = sponsors.filter((s) => s.nextAction).slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Open tasks" value={taskStats.open} accent />
        <StatTile label="Overdue" value={taskStats.overdue} tone={taskStats.overdue > 0 ? "danger" : "success"} />
        <StatTile label="Completed" value={taskStats.done} sub={`${taskStats.total} total`} />
        <StatTile label="Action items" value={actions.length} sub="from recent meetings" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Due in the next two weeks" action={<Link href="/tasks" className="text-xs text-muted hover:text-foreground">Board →</Link>}>
          {dueSoon.length === 0 ? <EmptyState>All clear.</EmptyState> : (
            <ul className="divide-y divide-border">
              {dueSoon.map((t) => (
                <ListRow key={t.id}
                  left={<><div className="truncate text-sm">{t.title}</div><div className="mt-0.5 text-xs text-muted">{t.assigneeName ?? "Unassigned"} · {t.status}</div></>}
                  right={<><Badge variant={t.priority === "Urgent" ? "danger" : t.priority === "High" ? "warning" : "neutral"}>{t.priority ?? "—"}</Badge><span className="text-xs tabular-nums text-muted">{formatDate(t.dueDate)}</span></>} />
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Action items">
          {actions.length === 0 ? <EmptyState>No open action items.</EmptyState> : (
            <ul className="divide-y divide-border">
              {actions.map((a, i) => (
                <li key={i} className="px-5 py-3">
                  <div className="text-sm">{a.text}</div>
                  <div className="mt-0.5 text-xs text-muted">{a.owner ?? "Unassigned"}{a.due ? ` · due ${a.due}` : ""}</div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Sponsorship next steps" action={<Link href="/sponsors" className="text-xs text-muted hover:text-foreground">Pipeline →</Link>}>
          {nextActions.length === 0 ? <EmptyState>No pending sponsor actions.</EmptyState> : (
            <ul className="divide-y divide-border">
              {nextActions.map((s) => (
                <ListRow key={s.id}
                  left={<><div className="truncate text-sm font-medium">{s.organisation}</div><div className="mt-0.5 text-xs text-muted">{s.nextAction}</div></>}
                  right={<Badge variant="accent">{s.stage ?? "—"}</Badge>} />
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Upcoming events">
          {events.length === 0 ? <EmptyState>Nothing scheduled.</EmptyState> : (
            <ul className="divide-y divide-border">
              {events.map((e) => (
                <ListRow key={e.id} href={`/events/${e.id}`}
                  left={<><div className="truncate text-sm font-medium">{e.name}</div><div className="mt-0.5 text-xs text-muted">{e.leadName ?? "no lead"}</div></>}
                  right={<span className="text-xs tabular-nums text-muted">{formatDate(e.startDate)}</span>} />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

/* ── Growth ─────────────────────────────────────────────────────────────── */

async function GrowthView() {
  const [members, faculties] = await Promise.all([getMemberStats(), getFacultyBreakdown()]);
  const latest = members.trend[members.trend.length - 1];
  const prev = members.trend[members.trend.length - 2];
  const delta = latest && prev ? latest.totalMembers - prev.totalMembers : 0;
  const maxFac = Math.max(1, ...faculties.map((f) => f.value));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Current members" value={members.current} accent />
        <StatTile label="DUSA members" value={members.dusa} sub={`${Math.round((members.dusa / (members.current || 1)) * 100)}% of members`} />
        <StatTile label="Non-DUSA" value={members.nonDusa} />
        <StatTile label="Week-on-week" value={`${delta >= 0 ? "+" : ""}${delta}`} tone={delta >= 0 ? "success" : "danger"} sub={latest?.newCount != null ? `${latest.newCount} new · ${latest.renewalCount} renewals` : undefined} />
      </div>

      <SectionCard title="Membership trend">
        <div className="p-5">
          <Sparkline data={members.trend.map((t) => t.totalMembers)} className="h-20" />
          <div className="mt-3 flex justify-between text-xs text-muted">
            <span>{members.trend[0]?.reportDate ? formatDate(members.trend[0].reportDate) : ""}</span>
            <span>{latest?.reportDate ? formatDate(latest.reportDate) : ""}</span>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="DUSA vs non-DUSA">
          <div className="p-5">
            <Segments segments={[
              { label: "DUSA members", value: members.dusa, tone: "accent" },
              { label: "Non-DUSA", value: members.nonDusa, tone: "muted" },
            ]} />
          </div>
        </SectionCard>

        <SectionCard title="By faculty">
          <div className="space-y-3 p-5">
            {faculties.length === 0 ? <EmptyState>No member data yet.</EmptyState> :
              faculties.slice(0, 6).map((f) => <BarRow key={f.label} label={f.label} value={f.value} max={maxFac} />)}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

/* ── Finance ────────────────────────────────────────────────────────────── */

async function MoneyView({
  canFinance,
  canWriteFinance,
}: {
  canFinance: boolean;
  canWriteFinance: boolean;
}) {
  const [finance, expenses, budgets, eventOptions] = await Promise.all([
    getFinanceSummary(),
    getExpenseBreakdown(),
    getEventBudgets(),
    canWriteFinance ? getEventOptions() : Promise.resolve([]),
  ]);
  const r = finance.report;
  const maxExp = Math.max(1, ...expenses.map((e) => e.value));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Club balance" value={formatAUD(r?.closingBalance)} accent sub={r?.reportDate ? `as at ${formatDate(r.reportDate)}` : "no report"} />
        <StatTile label="Income (FY)" value={formatAUD(r?.totalIncome)} tone="success" />
        <StatTile label="Expenses (FY)" value={formatAUD(r?.totalExpense)} tone="danger" />
        <StatTile label="Event budgets" value={formatAUD(finance.totalBudget)} sub={`${formatAUD(finance.totalGrant)} grants applied`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Where the money goes"
          action={
            canFinance ? (
              <Link href="/export/transactions" prefetch={false} className="text-xs text-muted hover:text-foreground">
                Export CSV →
              </Link>
            ) : undefined
          }
        >
          <div className="space-y-3 p-5">
            {expenses.length === 0 ? <EmptyState>No transactions imported yet.</EmptyState> :
              expenses.map((e) => <BarRow key={e.label} label={e.label} value={e.value} max={maxExp} display={formatAUD(e.value)} />)}
          </div>
        </SectionCard>

        <SectionCard title="Balance flow">
          <div className="space-y-4 p-5 text-sm">
            <Row label="Opening balance" value={formatAUD(r?.openingBalance)} />
            <Row label="+ Income" value={formatAUD(r?.totalIncome)} tone="success" />
            <Row label="− Expenses" value={formatAUD(r?.totalExpense)} tone="danger" />
            <div className="border-t border-border pt-3">
              <Row label="Closing balance" value={formatAUD(r?.closingBalance)} bold />
            </div>
          </div>
        </SectionCard>
      </div>

      {canWriteFinance && (
        <SectionCard title="Set an event budget" action={<span className="text-xs text-muted">grant auto-applied at 50%</span>}>
          {eventOptions.length === 0 ? (
            <EmptyState>No events yet — create one first.</EmptyState>
          ) : (
            <BudgetForm action={setEventBudget} events={eventOptions} />
          )}
        </SectionCard>
      )}

      <SectionCard title="Event budgets" action={<span className="text-xs text-muted">grant auto-applied at 50%</span>}>
        {budgets.length === 0 ? <EmptyState>No event budgets set yet — set one above.</EmptyState> : (
          <ul className="divide-y divide-border">
            {budgets.map((b) => (
              <ListRow key={b.id}
                left={<><div className="truncate text-sm font-medium">{b.name}</div><div className="mt-0.5 text-xs text-muted">{b.status ?? "—"}</div></>}
                right={<><span className="text-xs text-muted">grant {formatAUD(b.grantAud)}</span><span className="text-sm tabular-nums">{formatAUD(b.budgetAud)}</span></>} />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function Row({ label, value, tone, bold }: { label: string; value: string; tone?: "success" | "danger"; bold?: boolean }) {
  const c = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={`tabular-nums ${c} ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
