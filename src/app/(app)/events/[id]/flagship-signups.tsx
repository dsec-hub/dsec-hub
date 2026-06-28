"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge, EmptyState, SectionCard, buttonGhost, buttonSecondary } from "@/components/ui";
import { cn, formatDate } from "@/lib/format";
import {
  FLAGSHIP_STATE_LABELS,
  FLAGSHIP_THEME_LABELS,
  flagshipStateVariant,
} from "@/lib/options";
import { showUndoToast } from "@/lib/use-undo-toast";
import type { FlagshipSignupRow } from "@/lib/queries";

import { setEventFlagship, setFlagshipState } from "../actions";

const CSV_HEADERS = ["kind", "email", "name", "company", "message", "source", "created_at"] as const;

/** RFC-4180-ish CSV escaping: wrap in quotes when the cell has a comma/quote/newline. */
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: FlagshipSignupRow[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [r.kind, r.email, r.name, r.company, r.message, r.source, r.createdAt]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n");
}

/**
 * Flagship signups panel — the email-marketing-funnel management surface for a
 * flagship event's teaser page. Splits the captured "notify me" emails from
 * sponsor enquiries, exports the lot to CSV, and carries the two committee
 * controls: the teaser ⇄ revealed switch (declassify the event on the website)
 * and a quick "Remove flagship". Both are undoable.
 */
export function FlagshipSignups({
  eventId,
  eventName,
  theme,
  state,
  signups,
  canWrite,
}: {
  eventId: number;
  eventName: string;
  theme: string | null;
  state: string | null;
  signups: FlagshipSignupRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"all" | "notify" | "sponsor">("all");

  const notify = useMemo(() => signups.filter((s) => s.kind === "notify"), [signups]);
  const sponsor = useMemo(() => signups.filter((s) => s.kind === "sponsor"), [signups]);
  const shown = tab === "notify" ? notify : tab === "sponsor" ? sponsor : signups;
  const revealed = state === "revealed";

  function downloadCsv() {
    const blob = new Blob([toCsv(signups)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const slug = eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const a = document.createElement("a");
    a.href = url;
    a.download = `flagship-signups-${slug || eventId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function runState(next: string) {
    startTransition(async () => {
      const res = await setFlagshipState(eventId, next);
      showUndoToast(res, () => router.refresh());
    });
  }

  function removeFlagship() {
    startTransition(async () => {
      const res = await setEventFlagship(eventId, false);
      showUndoToast(res, () => router.refresh());
    });
  }

  return (
    <SectionCard
      title={`Flagship signups · ${signups.length}`}
      action={
        <button
          type="button"
          className={buttonGhost}
          onClick={downloadCsv}
          disabled={signups.length === 0}
        >
          Export CSV
        </button>
      }
    >
      <div className="space-y-4 p-5">
        {/* Management bar: current template + state, with the reveal switch. */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="neutral">
            {FLAGSHIP_THEME_LABELS[theme ?? "arena"] ?? "Arena"}
          </Badge>
          <Badge variant={flagshipStateVariant(state)}>
            {FLAGSHIP_STATE_LABELS[state ?? "teaser"] ?? "Teaser"}
          </Badge>
          {canWrite && (
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => runState(revealed ? "teaser" : "revealed")}
                className={buttonSecondary}
                title={
                  revealed
                    ? "Hide the real specifics again (back to teaser)"
                    : "Declassify to the full event page"
                }
              >
                {pending ? "…" : revealed ? "Reset to teaser" : "Reveal now"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={removeFlagship}
                className={buttonGhost}
                title="Remove the flagship treatment from this event"
              >
                Remove flagship
              </button>
            </div>
          )}
        </div>

        {/* Funnel counts. */}
        <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
          <Stat label="Notify signups" value={notify.length} />
          <Stat label="Sponsor enquiries" value={sponsor.length} />
        </div>

        {signups.length === 0 ? (
          <EmptyState>
            No signups yet. Share the teaser page to start the funnel.
          </EmptyState>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-xs">
              {(["all", "notify", "sponsor"] as const).map((t) => {
                const n = t === "all" ? signups.length : t === "notify" ? notify.length : sponsor.length;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={cn(
                      "rounded-full px-2.5 py-1 capitalize transition-colors",
                      tab === t ? "bg-accent/10 text-accent-text" : "text-muted hover:bg-elevated",
                    )}
                  >
                    {t} ({n})
                  </button>
                );
              })}
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-medium">Kind</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Company</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shown.map((s) => (
                    <tr key={s.id} className="align-top">
                      <td className="px-3 py-2">
                        <Badge variant={s.kind === "sponsor" ? "accent" : "neutral"}>{s.kind}</Badge>
                      </td>
                      <td className="px-3 py-2 break-all">{s.email}</td>
                      <td className="px-3 py-2">{s.name ?? "—"}</td>
                      <td className="px-3 py-2">{s.company ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted">
                        {formatDate(s.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="font-title text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}
