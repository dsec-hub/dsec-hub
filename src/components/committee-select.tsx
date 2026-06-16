import { SelectField } from "@/components/form";
import { cn } from "@/lib/format";

export type CommitteeChoice = { id: number; name: string };

/** A small colour dot for a committee; falls back to a neutral fill when unset. */
export function CommitteeDot({
  color,
  className,
}: {
  color?: string | null;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color ?? "var(--color-border)" }}
    />
  );
}

/**
 * Committee picker backed by the DB list. Stores the committee *name* (records
 * elsewhere keep the name as a string, so renames cascade by value). If the
 * record's current committee isn't in the active list — it was deactivated or
 * renamed away — we still render it as a selectable "(inactive)" option so
 * saving the form never silently drops the existing assignment.
 */
export function CommitteeSelect({
  committees,
  defaultValue,
  name = "committee",
}: {
  committees: CommitteeChoice[];
  defaultValue?: string | null;
  name?: string;
}) {
  const current = defaultValue ?? "";
  const inList = committees.some((c) => c.name === current);
  return (
    <SelectField name={name} defaultValue={current}>
      <option value="">—</option>
      {current && !inList && <option value={current}>{current} (inactive)</option>}
      {committees.map((c) => (
        <option key={c.id} value={c.name}>
          {c.name}
        </option>
      ))}
    </SelectField>
  );
}
