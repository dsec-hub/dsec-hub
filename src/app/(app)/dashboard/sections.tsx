import Link from "next/link";

import { BarRow, ListRow, Segments, Sparkline, StatTile } from "@/components/dashboard";
import { Badge, EmptyState, SectionCard } from "@/components/ui";
import type { CommitteeScope } from "@/lib/scope";
import { formatAUD, formatDate, todayISO } from "@/lib/format";
import {
  getCommitteeHealth,
  getDocuments,
  getEventBudgets,
  getEventOptions,
  getExpenseBreakdown,
  getFinanceSummary,
  getMemberStats,
  getMyOpenTasks,
  getOpenActionItems,
  getPartners,
  getProjects,
  getProjectStats,
  getSponsorPipeline,
  getTasksDueSoon,
  getUpcomingEvents,
  getUpcomingMeetings,
} from "@/lib/workspace-queries";

import { setEventBudget } from "./budget-actions";
import { BudgetForm } from "./budget-form";

const moreLink = (href: string, label: string) => (
  <Link href={href} className="text-xs text-muted hover:text-foreground">
    {label}
  </Link>
);

/* ── Headline stats (role-aware) ─────────────────────────────────────────── */

export async function HeadlineStats({
  showMembers,
  showFinance,
  showTasks,
  showEvents,
}: {
  showMembers: boolean;
  showFinance: boolean;
  showTasks: boolean;
  showEvents: boolean;
}) {
  const [members, finance, events] = await Promise.all([
    showMembers ? getMemberStats() : Promise.resolve(null),
    showFinance ? getFinanceSummary() : Promise.resolve(null),
    showEvents ? getUpcomingEvents(5) : Promise.resolve([]),
  ]);
  const taskStats = showTasks
    ? await import("@/lib/workspace-queries").then((m) => m.getTaskStats())
    : null;

  const tiles = [
    members && (
      <StatTile key="m" label="Current members" value={members.current} accent sub={`${members.dusa} DUSA · ${members.nonDusa} non-DUSA`} />
    ),
    finance && (
      <StatTile key="f" label="Club balance" value={formatAUD(finance.report?.closingBalance)} sub={finance.report?.reportDate ? `as at ${formatDate(finance.report.reportDate)}` : "no report yet"} />
    ),
    taskStats && (
      <StatTile key="t" label="Open tasks" value={taskStats.open} tone={taskStats.overdue > 0 ? "warning" : undefined} sub={`${taskStats.overdue} overdue`} />
    ),
    showEvents && (
      <StatTile key="e" label="Upcoming events" value={events.length} sub={events[0] ? `next: ${formatDate(events[0].startDate)}` : "none scheduled"} />
    ),
  ].filter(Boolean);

  if (tiles.length === 0) return null;
  return <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{tiles}</div>;
}

/* ── My Work ─────────────────────────────────────────────────────────────── */

export async function MyWorkSection({ personId }: { personId: number | null }) {
  if (personId == null) {
    return (
      <SectionCard title="My Work">
        <EmptyState>
          Link your roster record in Settings → Profile to see tasks assigned to you.
        </EmptyState>
      </SectionCard>
    );
  }
  const today = todayISO();
  const tasks = await getMyOpenTasks(personId, 14);
  return (
    <SectionCard title="My Work" action={moreLink("/tasks?view=my-work", "All →")}>
      {tasks.length === 0 ? (
        <EmptyState>Nothing assigned to you right now. Nice.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {tasks.map((t) => {
            const overdue = t.dueDate != null && t.dueDate < today;
            return (
              <ListRow
                key={t.id}
                href={`/tasks/${t.id}/edit`}
                left={
                  <>
                    <div className="truncate text-sm">{t.title}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {t.status}
                      {t.committee ? ` · ${t.committee}` : ""}
                    </div>
                  </>
                }
                right={
                  t.dueDate ? (
                    <span className={overdue ? "text-xs font-medium tabular-nums text-danger" : "text-xs tabular-nums text-muted"}>
                      {overdue ? "overdue · " : ""}
                      {formatDate(t.dueDate)}
                    </span>
                  ) : null
                }
              />
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

/* ── Upcoming events ─────────────────────────────────────────────────────── */

export async function UpcomingEventsSection() {
  const events = await getUpcomingEvents(6);
  return (
    <SectionCard title="Upcoming events" action={moreLink("/events", "All →")}>
      {events.length === 0 ? (
        <EmptyState>Nothing scheduled.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {events.map((e) => (
            <ListRow
              key={e.id}
              href={`/events/${e.id}`}
              left={
                <>
                  <div className="truncate text-sm font-medium">{e.name}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {formatDate(e.startDate)} · {e.venue ?? "—"}
                  </div>
                </>
              }
              right={<Badge variant="neutral">{e.status ?? "—"}</Badge>}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/* ── Tasks due soon ──────────────────────────────────────────────────────── */

export async function TasksDueSoonSection() {
  const dueSoon = await getTasksDueSoon(14, 8);
  return (
    <SectionCard title="Tasks due soon" action={moreLink("/tasks", "Board →")}>
      {dueSoon.length === 0 ? (
        <EmptyState>Nothing due in the next two weeks.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {dueSoon.map((t) => (
            <ListRow
              key={t.id}
              left={
                <>
                  <div className="truncate text-sm">{t.title}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {t.assigneeName ?? "Unassigned"} · {t.committee ?? "—"}
                  </div>
                </>
              }
              right={<span className="text-xs tabular-nums text-muted">{formatDate(t.dueDate)}</span>}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/* ── Action items ────────────────────────────────────────────────────────── */

export async function ActionItemsSection({ scope }: { scope: CommitteeScope }) {
  const actions = await getOpenActionItems(scope, 8);
  return (
    <SectionCard title="Action items" action={moreLink("/meetings", "Meetings →")}>
      {actions.length === 0 ? (
        <EmptyState>No open action items from recent meetings.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {actions.map((a, i) => (
            <li key={i} className="px-5 py-3">
              <div className="text-sm">{a.text}</div>
              <div className="mt-0.5 text-xs text-muted">
                {a.owner ?? "Unassigned"}
                {a.due ? ` · due ${a.due}` : ""} · {a.meeting}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/* ── Committee health ────────────────────────────────────────────────────── */

export async function CommitteeHealthSection() {
  const rows = await getCommitteeHealth();
  return (
    <SectionCard title="Committee health" action={moreLink("/tasks?view=by-committee", "View tasks →")}>
      {rows.length === 0 ? (
        <EmptyState>No committees yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((c) => (
            <ListRow
              key={c.name}
              left={
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: c.color ?? "var(--color-muted)" }}
                      aria-hidden
                    />
                    <span className="truncate text-sm font-medium">{c.name}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {c.lead ? `Lead: ${c.lead}` : "No lead"} · {c.members} {c.members === 1 ? "member" : "members"}
                  </div>
                </>
              }
              right={
                <>
                  {c.overdue > 0 && <Badge variant="danger">{c.overdue} overdue</Badge>}
                  <span className="text-xs tabular-nums text-muted">{c.open} open</span>
                </>
              }
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/* ── Membership ──────────────────────────────────────────────────────────── */

export async function MembershipSection() {
  const members = await getMemberStats();
  return (
    <SectionCard title="Membership" action={moreLink("/members", "All →")}>
      <div className="p-5">
        <Sparkline data={members.trend.map((t) => t.totalMembers)} className="h-12" />
        <div className="mt-4">
          <Segments
            segments={[
              { label: "DUSA", value: members.dusa, tone: "accent" },
              { label: "Non-DUSA", value: members.nonDusa, tone: "muted" },
            ]}
          />
        </div>
      </div>
    </SectionCard>
  );
}

/* ── Finance summary ─────────────────────────────────────────────────────── */

export async function FinanceSummarySection() {
  const finance = await getFinanceSummary();
  const r = finance.report;
  return (
    <SectionCard title="Balance flow" action={moreLink("/finance", "Finance →")}>
      <div className="space-y-4 p-5 text-sm">
        <FinanceRow label="Opening balance" value={formatAUD(r?.openingBalance)} />
        <FinanceRow label="+ Income" value={formatAUD(r?.totalIncome)} tone="success" />
        <FinanceRow label="− Expenses" value={formatAUD(r?.totalExpense)} tone="danger" />
        <div className="border-t border-border pt-3">
          <FinanceRow label="Closing balance" value={formatAUD(r?.closingBalance)} bold />
        </div>
      </div>
    </SectionCard>
  );
}

/* ── Expense breakdown ───────────────────────────────────────────────────── */

export async function ExpenseBreakdownSection() {
  const expenses = await getExpenseBreakdown();
  const maxExp = Math.max(1, ...expenses.map((e) => e.value));
  return (
    <SectionCard title="Where the money goes" action={moreLink("/export/transactions", "Export →")}>
      <div className="space-y-3 p-5">
        {expenses.length === 0 ? (
          <EmptyState>No transactions imported yet.</EmptyState>
        ) : (
          expenses.map((e) => <BarRow key={e.label} label={e.label} value={e.value} max={maxExp} display={formatAUD(e.value)} />)
        )}
      </div>
    </SectionCard>
  );
}

/* ── Event budgets ───────────────────────────────────────────────────────── */

export async function EventBudgetsSection({ canWriteFinance }: { canWriteFinance: boolean }) {
  const [budgets, eventOptions] = await Promise.all([
    getEventBudgets(),
    canWriteFinance ? getEventOptions() : Promise.resolve([]),
  ]);
  return (
    <SectionCard title="Event budgets" action={<span className="text-xs text-muted">grant auto-applied at 50%</span>}>
      {canWriteFinance && eventOptions.length > 0 && (
        <div className="border-b border-border px-5 py-4">
          <BudgetForm action={setEventBudget} events={eventOptions} />
        </div>
      )}
      {budgets.length === 0 ? (
        <EmptyState>No event budgets set yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {budgets.map((b) => (
            <ListRow
              key={b.id}
              left={
                <>
                  <div className="truncate text-sm font-medium">{b.name}</div>
                  <div className="mt-0.5 text-xs text-muted">{b.status ?? "—"}</div>
                </>
              }
              right={
                <>
                  <span className="text-xs text-muted">grant {formatAUD(b.grantAud)}</span>
                  <span className="text-sm tabular-nums">{formatAUD(b.budgetAud)}</span>
                </>
              }
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/* ── Sponsor pipeline ────────────────────────────────────────────────────── */

export async function SponsorPipelineSection() {
  const sponsors = await getSponsorPipeline();
  const nextActions = sponsors.filter((s) => s.nextAction).slice(0, 6);
  return (
    <SectionCard title="Sponsorship next steps" action={moreLink("/sponsors", "Pipeline →")}>
      {nextActions.length === 0 ? (
        <EmptyState>No pending sponsor actions.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {nextActions.map((s) => (
            <ListRow
              key={s.id}
              left={
                <>
                  <div className="truncate text-sm font-medium">{s.organisation}</div>
                  <div className="mt-0.5 text-xs text-muted">{s.nextAction}</div>
                </>
              }
              right={<Badge variant="accent">{s.stage ?? "—"}</Badge>}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/* ── Active projects ─────────────────────────────────────────────────────── */

export async function ActiveProjectsSection() {
  const [projects, stats] = await Promise.all([getProjects(), getProjectStats()]);
  const active = projects.filter((p) => p.status !== "Completed" && p.status !== "Showcased").slice(0, 6);
  return (
    <SectionCard
      title="Active projects"
      action={moreLink("/projects", `${stats.shipped} shipped →`)}
    >
      {active.length === 0 ? (
        <EmptyState>No projects in flight right now.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {active.map((p) => (
            <ListRow
              key={p.id}
              href={`/projects/${p.id}`}
              left={
                <>
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {p.leadName ? `Lead: ${p.leadName}` : "No lead"}
                    {p.category ? ` · ${p.category}` : ""}
                  </div>
                </>
              }
              right={<Badge variant="neutral">{p.status ?? "—"}</Badge>}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/* ── Upcoming meetings ───────────────────────────────────────────────────── */

export async function UpcomingMeetingsSection({ scope }: { scope: CommitteeScope }) {
  const meetings = await getUpcomingMeetings(scope, 6);
  return (
    <SectionCard title="Upcoming meetings" action={moreLink("/meetings", "All →")}>
      {meetings.length === 0 ? (
        <EmptyState>No meetings scheduled.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {meetings.map((m) => (
            <ListRow
              key={m.id}
              href={`/meetings/${m.id}`}
              left={
                <>
                  <div className="truncate text-sm font-medium">{m.title}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {m.committee ?? "Club-wide"}
                    {m.location ? ` · ${m.location}` : ""}
                  </div>
                </>
              }
              right={
                <span className="text-xs tabular-nums text-muted">
                  {m.meetingDate ? formatDate(m.meetingDate) : "TBC"}
                </span>
              }
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/* ── Recent documents ────────────────────────────────────────────────────── */

export async function RecentDocumentsSection({ scope }: { scope: CommitteeScope }) {
  const docs = (await getDocuments(scope)).slice(0, 7);
  return (
    <SectionCard title="Recent documents" action={moreLink("/docs", "All →")}>
      {docs.length === 0 ? (
        <EmptyState>No documents yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {docs.map((d) => (
            <ListRow
              key={d.id}
              href={`/docs/${d.id}`}
              left={
                <>
                  <div className="truncate text-sm font-medium">{d.title}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    {d.type ?? "Doc"}
                    {d.committee ? ` · ${d.committee}` : ""}
                  </div>
                </>
              }
              right={d.status ? <Badge variant="neutral">{d.status}</Badge> : null}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/* ── Partner orgs ────────────────────────────────────────────────────────── */

export async function PartnersSection() {
  const partners = await getPartners();
  const top = partners.slice(0, 6);
  return (
    <SectionCard title="Partner orgs" action={moreLink("/partners", "All →")}>
      {top.length === 0 ? (
        <EmptyState>No partner organisations yet.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {top.map((p) => (
            <ListRow
              key={p.id}
              href={`/partners/${p.id}`}
              left={
                <>
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  {p.website ? (
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {p.website.replace(/^https?:\/\//, "")}
                    </div>
                  ) : null}
                </>
              }
              right={p.showOnWebsite ? <Badge variant="accent">On website</Badge> : null}
            />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function FinanceRow({
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
  const c = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={`tabular-nums ${c} ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
