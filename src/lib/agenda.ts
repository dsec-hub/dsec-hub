import type { AgendaItem } from "@/db/workspace-schema";

/** Items in display order (the stored `order`, falling back to array order). */
export function sortedAgenda(items: AgendaItem[] | null | undefined): AgendaItem[] {
  return [...(items ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Sum of every item's estimated duration, in minutes. */
export function totalAgendaMinutes(items: AgendaItem[] | null | undefined): number {
  return (items ?? []).reduce((sum, i) => sum + (Number(i.duration_minutes) || 0), 0);
}

/** Human duration: 0 → "0 min", 45 → "45 min", 90 → "1h 30m", 120 → "2h". */
export function formatDuration(minutes: number | null | undefined): string {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m === 0) return "0 min";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

/** Badge variant + label for an agenda status. */
export function agendaStatusMeta(status: string | null | undefined): {
  label: string;
  variant: "neutral" | "accent" | "success" | "warning";
} {
  switch (status) {
    case "shared":
      return { label: "Shared", variant: "success" };
    case "locked":
      return { label: "Locked", variant: "warning" };
    default:
      return { label: "Draft", variant: "neutral" };
  }
}
