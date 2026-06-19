import Link from "next/link";
import { notFound } from "next/navigation";

import { UndoButton } from "@/components/undo-button";
import { Badge, EmptyState, PageHeader, SectionCard, buttonGhost } from "@/components/ui";
import { getCommitteeOptions } from "@/lib/committee-queries";
import { requireModule } from "@/lib/dal";
import { cn, formatDate } from "@/lib/format";
import { canAccess, canWrite } from "@/lib/rbac";
import { committeeScopeOf } from "@/lib/scope";
import { docStatusVariant } from "@/lib/workspace-options";
import {
  getBoardOptions,
  getEventOptions,
  getPersonOptions,
  getProjectOptions,
  getTaskById,
  getTaskDocuments,
} from "@/lib/workspace-queries";
import { getTaskOwnerIds } from "@/lib/owners";
import { getSubtasks } from "@/lib/task-view-queries";

import { archiveTask, deleteTask, updateTask } from "../../actions";
import { Subtasks } from "../../subtasks";
import { TaskForm } from "../../task-form";

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireModule("tasks");
  const writable = canWrite(me.modules, me.writeModules, "tasks");
  const { id } = await params;
  const taskId = Number(id);
  if (Number.isNaN(taskId)) notFound();

  const [task, boards, people, events, projects, committees, subtasks, coOwnerIds] = await Promise.all([
    getTaskById(taskId),
    getBoardOptions(),
    getPersonOptions(),
    getEventOptions(),
    getProjectOptions(),
    getCommitteeOptions(),
    getSubtasks(taskId),
    getTaskOwnerIds(taskId),
  ]);
  if (!task) notFound();

  // Docs attached to this task (document.related_task_id). Only shown to users
  // who can see the Docs module, and committee-scoped inside the query.
  const canSeeDocs = canAccess(me.modules, "documents");
  const linkedDocs = canSeeDocs ? await getTaskDocuments(taskId, committeeScopeOf(me)) : [];

  return (
    <>
      <PageHeader
        title="Edit task"
        description={task.title}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Tasks", href: "/tasks" },
          { label: task.title },
        ]}
        action={
          writable ? (
            <div className="flex items-center gap-2">
              <UndoButton action={archiveTask.bind(null, taskId)} redirectTo="/tasks" className={buttonGhost}>
                Archive
              </UndoButton>
              <UndoButton action={deleteTask.bind(null, taskId)} confirm="Delete this task permanently?" redirectTo="/tasks" className={cn(buttonGhost, "text-danger hover:text-danger")}>
                Delete
              </UndoButton>
            </div>
          ) : undefined
        }
      />
      <TaskForm
        action={updateTask.bind(null, taskId)}
        task={task}
        boards={boards}
        people={people}
        events={events}
        projects={projects}
        committees={committees}
        coOwnerIds={coOwnerIds}
        redirectOnSuccess="/tasks"
        canWrite={writable}
      />

      {/* One-level subtasks: only top-level tasks get a checklist. A subtask
          shows a link back to its parent instead. */}
      <div className="mt-6">
        {task.parentTaskId == null ? (
          <Subtasks parentId={taskId} subtasks={subtasks} canWrite={writable} />
        ) : (
          <p className="text-sm text-muted">
            This is a subtask of{" "}
            <Link href={`/tasks/${task.parentTaskId}/edit`} className="text-accent-text hover:underline">
              its parent task
            </Link>
            .
          </p>
        )}
      </div>

      {canSeeDocs && (
        <div className="mt-6">
          <SectionCard title={`Linked documents${linkedDocs.length ? ` (${linkedDocs.length})` : ""}`}>
            {linkedDocs.length === 0 ? (
              <EmptyState>
                No documents linked yet. Attach one from a doc’s “Related task” field.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-border">
                {linkedDocs.map((doc) => (
                  <li key={doc.id}>
                    <Link
                      href={`/docs/${doc.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-elevated"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{doc.title}</div>
                        <div className="mt-0.5 truncate text-xs text-muted">
                          {formatDate(doc.updatedAt)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {doc.type && <Badge variant="neutral">{doc.type}</Badge>}
                        <Badge variant={docStatusVariant(doc.status)}>{doc.status ?? "Draft"}</Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      )}
    </>
  );
}
