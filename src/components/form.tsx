import { isValidElement, cloneElement, useId } from "react";

import { cn } from "@/lib/format";
import { Icons } from "@/components/icons";

export const controlBase =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-60";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  // Associate the label with its control so clicking the label focuses the input
  // and screen readers announce a name. Most call sites don't pass htmlFor, so we
  // generate an id and inject it into a single element child that has none. An
  // explicit htmlFor (or a child that already sets its own id) always wins.
  const autoId = useId();
  let control = children;
  let controlId = htmlFor;
  if (!htmlFor && isValidElement(children)) {
    const childProps = children.props as { id?: string };
    controlId = childProps.id ?? autoId;
    if (!childProps.id) {
      control = cloneElement(children as React.ReactElement<{ id?: string }>, {
        id: controlId,
      });
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={controlId} className="text-sm text-muted">
        {label}
      </label>
      {control}
      {hint && !error && <p className="text-xs text-muted/70">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlBase, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} className={cn(controlBase, "min-h-20 resize-y", props.className)} />
  );
}

export function SelectField({
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  // Safari/iOS draw native <select> chrome (system chevron, inset shadow,
  // forced radius) that ignores most of `controlBase`. `appearance-none` flattens
  // it so the control matches our inputs in every browser; we then supply our own
  // chevron. `pr-9` reserves room for it.
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(controlBase, "cursor-pointer appearance-none pr-9", className)}
      >
        {children}
      </select>
      <Icons.chevron className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function CheckboxField({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex items-center gap-2.5 text-sm">
      <input
        type="checkbox"
        {...props}
        className="size-4 rounded border-border bg-background accent-[var(--color-accent)]"
      />
      <span>{label}</span>
    </label>
  );
}

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
      {children}
    </p>
  );
}
