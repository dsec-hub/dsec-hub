"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { buttonSecondary } from "@/components/ui";

import { generateMeetingNotes, type NotesState } from "./notes-action";

export function GenerateNotesButton({ meetingId }: { meetingId: number }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<NotesState>(undefined);
  const router = useRouter();

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        className={buttonSecondary}
        onClick={() =>
          start(async () => {
            const result = await generateMeetingNotes(meetingId);
            setState(result);
            if (result?.ok) router.refresh();
          })
        }
      >
        {pending ? "Generating…" : "✦ Generate AI notes"}
      </button>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      {state?.ok && <p className="text-xs text-success">{state.ok}</p>}
    </div>
  );
}
