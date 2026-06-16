"use client";

import { useFormStatus } from "react-dom";

import { cn } from "@/lib/format";
import { buttonPrimary } from "./ui";

export function SubmitButton({
  children = "Save",
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn(buttonPrimary, className)}>
      {pending ? "Saving…" : children}
    </button>
  );
}
