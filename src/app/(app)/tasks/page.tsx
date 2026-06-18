import { StatTile } from "@/components/dashboard";
import { PageHeader } from "@/components/ui";
import { getCommitteeOptions } from "@/lib/committee-queries";
import { requireModule } from "@/lib/dal";
import { todayISO } from "@/lib/format";
import { canWrite } from "@/lib/rbac";
import { isBuiltInViewKey } from "@/lib/task-view-types";
import { getSavedViews, getTasksForViews } from "@/lib/task-view-queries";
import { DEFAULT_BOARD_COLUMNS } from "@/lib/workspace-options";
import {
  getBoardOptions,
  getBoards,
  getEventOptions,
  getPersonOptions,
  getProjectOptions,
  getTaskStats,
} from "@/lib/workspace-queries";

import { NewBoardButton } from "./new-board-button";
import { NewTaskButton } from "./new-task-button";
import { TasksWorkspace } from "./tasks-workspace";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const me = await requireModule("tasks");
  const fullWrite = canWrite(me.modules, me.writeModules, "tasks");
  const { view: rawView } = await searchParams;

  const [tasks, savedViews, stats, committeeOpts, people, events, projects, boardOptions, boards] =
    await Promise.all([
      getTasksForViews(),
      getSavedViews(me.id),
      getTaskStats(),
      getCommitteeOptions(),
      getPersonOptions(),
      getEventOptions(),
      getProjectOptions(),
      getBoardOptions(),
      getBoards(),
    ]);

  // Status vocabulary = the default columns plus any custom column any board uses.
  const statusSet = new Set<string>(DEFAULT_BOARD_COLUMNS);
  for (const b of boards) for (const c of (b.columns ?? []) as string[]) statusSet.add(c);
  const statuses = [...statusSet];

  const committees = committeeOpts.map((c) => c.name);

  // Initial view: explicit ?view=, else the role's default, else My Work.
  const roleDefault = me.viewConfig?.defaultTaskView ?? "";
  const initialViewKey =
    rawView && (rawView.startsWith("saved:") || isBuiltInViewKey(rawView))
      ? rawView
      : isBuiltInViewKey(roleDefault)
        ? roleDefault
        : "my-work";

  return (
    <>
      <PageHeader
        title="Tasks"
        description="One pool of tasks, sliced by view — switch lenses, filter, or save your own."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Tasks" }]}
        action={
          fullWrite ? (
            <div className="flex items-center gap-2">
              <NewBoardButton committees={committeeOpts} />
              <NewTaskButton
                boards={boardOptions}
                people={people}
                events={events}
                projects={projects}
                committees={committeeOpts}
              />
            </div>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatTile label="Open" value={stats.open} accent />
        <StatTile
          label="Overdue"
          value={stats.overdue}
          tone={stats.overdue > 0 ? "danger" : "success"}
        />
        <StatTile label="Completed" value={stats.done} sub={`${stats.total} total`} />
      </div>

      <TasksWorkspace
        tasks={tasks}
        savedViews={savedViews}
        personId={me.personId}
        fullWrite={fullWrite}
        today={todayISO()}
        statuses={statuses}
        options={{ committees, people, events, statuses, boards: boardOptions }}
        initialViewKey={initialViewKey}
      />
    </>
  );
}
