"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { buttonSecondary } from "@/components/ui";
import { cn } from "@/lib/format";

import { resetUserOnboarding } from "./actions";

/** Admin control: re-trigger the first-run onboarding wizard for a user. Hidden
 * behind a confirm so it isn't fired by accident. Disabled (and relabelled) when
 * the user is already awaiting onboarding. */
export function ResetOnboardingButton({
  userId,
  completed,
}: {
  userId: number;
  completed: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const onClick = () => {
    if (
      !confirm(
        "Send this user through onboarding again? On their next visit they'll be asked to set up their profile before they can use the app. Their current details are kept and prefilled.",
      )
    )
      return;
    start(async () => {
      const res = await resetUserOnboarding(userId);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(res?.message ?? "Onboarding reset.");
        router.refresh();
      }
    });
  };

  return (
    <button
      type="button"
      className={cn(buttonSecondary)}
      onClick={onClick}
      disabled={pending || !completed}
    >
      {pending ? "Resetting…" : completed ? "Reset onboarding" : "Awaiting onboarding"}
    </button>
  );
}
