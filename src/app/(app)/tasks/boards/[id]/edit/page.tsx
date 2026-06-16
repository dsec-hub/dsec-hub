import { notFound } from "next/navigation";

import { UndoButton } from "@/components/undo-button";
import { PageHeader, buttonGhost } from "@/components/ui";
import { getCommitteeOptions } from "@/lib/committee-queries";
import { requireModule } from "@/lib/dal";
import { cn } from "@/lib/format";
import { canWrite } from "@/lib/rbac";
import { getBoardById } from "@/lib/workspace-queries";

import { archiveBoard, deleteBoard, updateBoard } from "../../../actions";
import { BoardForm } from "../../../board-form";

export default async function EditBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireModule("tasks");
  const writable = canWrite(me.modules, me.writeModules, "tasks");
  const { id } = await params;
  const boardId = Number(id);
  if (Number.isNaN(boardId)) notFound();

  const [board, committees] = await Promise.all([
    getBoardById(boardId),
    getCommitteeOptions(),
  ]);
  if (!board) notFound();

  return (
    <>
      <PageHeader
        title="Edit board"
        description={board.name}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Tasks", href: "/tasks" },
          { label: board.name },
        ]}
        action={
          writable ? (
            <div className="flex items-center gap-2">
              <UndoButton
                action={archiveBoard.bind(null, boardId)}
                redirectTo="/tasks"
                className={buttonGhost}
              >
                Archive
              </UndoButton>
              <UndoButton
                action={deleteBoard.bind(null, boardId)}
                confirm="Delete this board permanently? Its tasks will move to the Inbox."
                redirectTo="/tasks"
                className={cn(buttonGhost, "text-danger hover:text-danger")}
              >
                Delete
              </UndoButton>
            </div>
          ) : undefined
        }
      />
      <BoardForm
        action={updateBoard.bind(null, boardId)}
        board={board}
        committees={committees}
        redirectOnSuccess="/tasks"
        canWrite={writable}
      />
    </>
  );
}
