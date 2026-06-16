"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { CommitteeSelect } from "@/components/committee-select";
import { Field, FormError, TextArea, TextInput } from "@/components/form";
import { Icons } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { buttonGhost, buttonSecondary } from "@/components/ui";
import { cn } from "@/lib/format";
import { useUndoToast } from "@/lib/use-undo-toast";
import { DEFAULT_BOARD_COLUMNS } from "@/lib/workspace-options";
import type { taskBoards } from "@/db/workspace-schema";
import type { FormState } from "./actions";

type BoardRow = typeof taskBoards.$inferSelect;
type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function BoardForm({
  action,
  board,
  committees,
  onSuccess,
  onCancel,
  redirectOnSuccess,
  canWrite = true,
}: {
  action: Action;
  board?: BoardRow;
  committees: { id: number; name: string }[];
  onSuccess?: () => void;
  onCancel?: () => void;
  redirectOnSuccess?: string;
  canWrite?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  useUndoToast(state);
  const router = useRouter();

  useEffect(() => {
    if (!state?.ok) return;
    if (onSuccess) onSuccess();
    else if (redirectOnSuccess) router.push(redirectOnSuccess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <fieldset disabled={!canWrite} className="space-y-6">
        <FormError>{state?.error}</FormError>

        <Field label="Name">
          <TextInput
            name="name"
            required
            defaultValue={board?.name ?? ""}
            placeholder="e.g. Events board"
          />
        </Field>

        <Field label="Committee">
          <CommitteeSelect committees={committees} defaultValue={board?.committee} />
        </Field>

        <Field
          label="Description"
          hint={board ? undefined : "Columns default to Backlog · To Do · In Progress · Done."}
        >
          <TextArea name="description" defaultValue={board?.description ?? ""} />
        </Field>

        {board && (
          <Field
            label="Columns"
            hint="Each column is a task status, ordered left to right. Renaming a column leaves existing tasks where they are."
          >
            <ColumnsEditor
              initial={(board.columns as string[] | null) ?? [...DEFAULT_BOARD_COLUMNS]}
            />
          </Field>
        )}
      </fieldset>

      <div className="flex items-center gap-3">
        {canWrite ? (
          <SubmitButton>{board ? "Save changes" : "Create board"}</SubmitButton>
        ) : (
          <p className="text-sm text-muted">
            View only — you don’t have edit access for this section.
          </p>
        )}
        {onCancel ? (
          <button type="button" onClick={onCancel} className={buttonSecondary}>
            Cancel
          </button>
        ) : (
          <Link href="/tasks" className={buttonSecondary}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}

const iconBtn =
  "grid size-9 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

/**
 * Edit a board's status columns: rename inline, reorder, add, and remove. Each
 * row renders an input named `columns`, so the form submits them in DOM order
 * (== left-to-right column order); the action trims blanks and de-dupes. At
 * least one column is always kept.
 */
function ColumnsEditor({ initial }: { initial: string[] }) {
  const [cols, setCols] = useState<string[]>(
    initial.length ? initial : [...DEFAULT_BOARD_COLUMNS],
  );

  const setAt = (i: number, v: string) =>
    setCols((cs) => cs.map((c, idx) => (idx === i ? v : c)));
  const removeAt = (i: number) => setCols((cs) => cs.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) =>
    setCols((cs) => {
      const j = i + dir;
      if (j < 0 || j >= cs.length) return cs;
      const next = [...cs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <div className="space-y-2">
      {cols.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <TextInput
            name="columns"
            value={c}
            onChange={(e) => setAt(i, e.target.value)}
            placeholder={`Column ${i + 1}`}
            aria-label={`Column ${i + 1} name`}
          />
          <button
            type="button"
            onClick={() => move(i, -1)}
            disabled={i === 0}
            aria-label="Move column up"
            className={iconBtn}
          >
            <Icons.chevron className="size-4 rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => move(i, 1)}
            disabled={i === cols.length - 1}
            aria-label="Move column down"
            className={iconBtn}
          >
            <Icons.chevron className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => removeAt(i)}
            disabled={cols.length <= 1}
            aria-label="Remove column"
            className={cn(iconBtn, "hover:text-danger")}
          >
            <Icons.close className="size-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setCols((cs) => [...cs, ""])}
        className={buttonGhost}
      >
        + Add column
      </button>
    </div>
  );
}
