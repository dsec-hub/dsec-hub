import Link from "next/link";

import { PageHeader, SectionCard } from "@/components/ui";
import { CANONICAL_SECTIONS, visibleSections } from "@/lib/dashboard-config";
import { requireUser } from "@/lib/dal";
import { committeeScopeOf } from "@/lib/scope";
import { MODULES, canAccess, canWrite, type ModuleKey } from "@/lib/rbac";

import {
  ActionItemsSection,
  ActiveProjectsSection,
  CommitteeHealthSection,
  EventBudgetsSection,
  ExpenseBreakdownSection,
  FinanceSummarySection,
  HeadlineStats,
  MembershipSection,
  MyWorkSection,
  PartnersSection,
  RecentDocumentsSection,
  SponsorPipelineSection,
  TasksDueSoonSection,
  UpcomingEventsSection,
  UpcomingMeetingsSection,
} from "./sections";

// The dashboard is composed from the role's Focus config (view_config.sections):
// each canonical section renders only if the role enabled it AND the viewer can
// access its module. Admins enable everything; scoped roles see a focused page.
export default async function DashboardPage() {
  const user = await requireUser();
  const visible = visibleSections(user.viewConfig);
  const sectionModule = new Map(CANONICAL_SECTIONS.map((s) => [s.id, s.module]));
  const show = (id: string) =>
    visible.has(id) && canAccess(user.modules, sectionModule.get(id) as ModuleKey);

  const showMyWork = show("my_work");
  const showBudgets = show("event_budgets");
  const canWriteFinance = canWrite(user.modules, user.writeModules, "finance");
  const scope = committeeScopeOf(user);

  // Two-column detail sections (My Work + event budgets render full-width).
  // Order here is the dashboard's global render order; each role shows a subset.
  const gridSections = [
    show("tasks_due_soon") && <TasksDueSoonSection key="td" />,
    show("action_items") && <ActionItemsSection key="ai" scope={scope} />,
    show("upcoming_events") && <UpcomingEventsSection key="ue" />,
    show("upcoming_meetings") && <UpcomingMeetingsSection key="um" scope={scope} />,
    show("active_projects") && <ActiveProjectsSection key="ap" />,
    show("sponsor_pipeline") && <SponsorPipelineSection key="sp" />,
    show("partners") && <PartnersSection key="pa" />,
    show("committee_health") && <CommitteeHealthSection key="ch" />,
    show("membership") && <MembershipSection key="mb" />,
    show("finance_summary") && <FinanceSummarySection key="fs" />,
    show("expense_breakdown") && <ExpenseBreakdownSection key="ex" />,
    show("recent_documents") && <RecentDocumentsSection key="rd" scope={scope} />,
  ].filter(Boolean);

  const empty = !showMyWork && !showBudgets && gridSections.length === 0;
  const accessible = MODULES.filter((m) => m.key !== "admin" && canAccess(user.modules, m.key));

  return (
    <>
      <PageHeader title="Dashboard" description="Your DSEC workspace at a glance." />
      <div className="space-y-6">
        <HeadlineStats
          showMembers={canAccess(user.modules, "members")}
          showFinance={canAccess(user.modules, "finance")}
          showTasks={canAccess(user.modules, "tasks")}
          showEvents={canAccess(user.modules, "events")}
        />

        {showMyWork && <MyWorkSection personId={user.personId} />}

        {gridSections.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">{gridSections}</div>
        )}

        {showBudgets && <EventBudgetsSection canWriteFinance={canWriteFinance} />}

        {empty && (
          <SectionCard title={`Welcome, ${user.name ?? "team"}`}>
            <div className="space-y-3 px-5 py-5 text-sm text-muted">
              <p>
                You&rsquo;re signed in as <strong className="text-foreground">{user.roleName ?? "a member"}</strong>.
                {accessible.length > 0
                  ? " Here&rsquo;s what you can open:"
                  : " You don&rsquo;t have any areas yet — an admin can grant access."}
              </p>
              {accessible.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {accessible.map((m) => (
                    <Link
                      key={m.key}
                      href={m.href}
                      className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-elevated"
                    >
                      {m.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        )}
      </div>
    </>
  );
}
