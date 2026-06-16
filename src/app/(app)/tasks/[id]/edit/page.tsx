import { notFound } from "next/navigation";

import { UndoButton } from "@/components/undo-button";
import { PageHeader, buttonGhost } from "@/components/ui";
import { getCommitteeOptions } from "@/lib/committee-queries";
import { requireModule } from "@/lib/dal";
import { cn } from "@/lib/format";
import { canWrite } from "@/lib/rbac";
import {
  getBoardOptions,
  getEventOptions,
  getPersonOptions,
  getProjectOptions,
  getTaskById,
} from "@/lib/workspace-queries";

import { archiveTask, deleteTask, updateTask } from "../../actions";
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

  const [task, boards, people, events, projects, committees] = await Promise.all([
    getTaskById(taskId),
    getBoardOptions(),
    getPersonOptions(),
    getEventOptions(),
    getProjectOptions(),
    getCommitteeOptions(),
  ]);
  if (!task) notFound();

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
        redirectOnSuccess="/tasks"
        canWrite={writable}
      />
    </>
  );
}
