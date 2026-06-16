import { StatTile, ViewTabs } from "@/components/dashboard";
import { PageHeader } from "@/components/ui";
import { getCommitteeOptions } from "@/lib/committee-queries";
import { requireModule } from "@/lib/dal";
import { canWrite } from "@/lib/rbac";
import {
  getBoardOptions,
  getBoardWithTasks,
  getEventOptions,
  getInboxColumns,
  getPersonOptions,
  getProjectOptions,
  getTaskStats,
} from "@/lib/workspace-queries";

import { NewBoardButton } from "./new-board-button";
import { NewTaskButton } from "./new-task-button";
import { TasksView } from "./tasks-view";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const me = await requireModule("tasks");
  const writable = canWrite(me.modules, me.writeModules, "tasks");
  const { board: rawBoard } = await searchParams;
  const isInbox = rawBoard === "inbox";
  const parsed = rawBoard ? Number(rawBoard) : undefined;
  const boardId = parsed && !Number.isNaN(parsed) ? parsed : undefined;

  const [
    { board, boards, columns },
    inbox,
    stats,
    boardOptions,
    people,
    events,
    projects,
    committees,
  ] = await Promise.all([
    getBoardWithTasks(boardId),
    getInboxColumns(),
    getTaskStats(),
    getBoardOptions(),
    getPersonOptions(),
    getEventOptions(),
    getProjectOptions(),
    getCommitteeOptions(),
  ]);

  // Inbox is selected explicitly, or implicitly when there are no boards at all.
  const showInbox = isInbox || board === null;
  const active = showInbox ? "inbox" : String(board!.id);
  const activeColumns = showInbox ? inbox.columns : columns;
  const activeBoard = showInbox
    ? null
    : {
        id: board!.id,
        name: board!.name,
        description: board!.description,
        committee: board!.committee,
      };

  const tabs = [
    {
      key: "inbox",
      label: inbox.count ? `Inbox · ${inbox.count}` : "Inbox",
      href: "/tasks?board=inbox",
    },
    ...boards.map((b) => ({
      key: String(b.id),
      label: b.name,
      href: `/tasks?board=${b.id}`,
    })),
  ];

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Trello-style boards across the committee. Tasks with no board land in the Inbox."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Tasks" }]}
        action={
          writable ? (
            <div className="flex items-center gap-2">
              <NewBoardButton committees={committees} />
              <NewTaskButton
                boards={boardOptions}
                people={people}
                events={events}
                projects={projects}
                committees={committees}
              />
            </div>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Open" value={stats.open} accent />
        <StatTile
          label="Overdue"
          value={stats.overdue}
          tone={stats.overdue > 0 ? "danger" : "success"}
        />
        <StatTile label="Completed" value={stats.done} sub={`${stats.total} total`} />
        <StatTile label="Boards" value={boards.length} />
      </div>

      <ViewTabs tabs={tabs} active={active} />
      <TasksView columns={activeColumns} board={activeBoard} canWrite={writable} />
    </>
  );
}
