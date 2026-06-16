"use client";

import { useRef } from "react";

import { SelectField } from "@/components/form";
import { moveTask } from "./actions";

/** Tiny inline status switcher — submits the bound moveTask action onChange. */
export function MoveControl({
  taskId,
  columns,
  current,
  canWrite,
}: {
  taskId: number;
  columns: string[];
  current: string;
  canWrite: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const options = columns.includes(current) ? columns : [current, ...columns];

  if (!canWrite) {
    return <span className="text-xs text-muted">{current}</span>;
  }

  return (
    <form ref={formRef} action={moveTask.bind(null, taskId)}>
      <SelectField
        name="status"
        defaultValue={current}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-8 w-36 py-1 text-xs"
        aria-label="Move task"
      >
        {options.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </SelectField>
    </form>
  );
}
