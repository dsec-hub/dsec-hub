import Link from "next/link";

import { Card } from "@/components/ui";
import { cn } from "@/lib/format";

/* ── Stat tile ──────────────────────────────────────────────────────────── */

export function StatTile({
  label,
  value,
  sub,
  accent = false,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
  tone?: "success" | "warning" | "danger";
}) {
  const toneClass = tone
    ? { success: "text-success", warning: "text-warning", danger: "text-danger" }[tone]
    : accent
      ? "text-accent-text"
      : "text-foreground";
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={cn("mt-2 font-title text-3xl font-semibold tabular-nums", toneClass)}>
        {value}
      </div>
      {sub != null && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </Card>
  );
}

/* ── Sparkline (inline SVG line chart) ──────────────────────────────────── */

export function Sparkline({
  data,
  className,
  height = 36,
  width = 120,
}: {
  data: number[];
  className?: string;
  height?: number;
  width?: number;
}) {
  if (data.length < 2) return <div className={cn("text-xs text-muted", className)}>—</div>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((d, i) => `${(i * step).toFixed(1)},${(height - ((d - min) / span) * height).toFixed(1)}`);
  const area = `0,${height} ${pts.join(" ")} ${width},${height}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("h-9 w-full", className)} preserveAspectRatio="none">
      <polygon points={area} fill="var(--color-accent)" opacity={0.08} />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ── Labeled horizontal bar (breakdowns) ────────────────────────────────── */

export function BarRow({
  label,
  value,
  max,
  display,
}: {
  label: string;
  value: number;
  max: number;
  display?: string;
}) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-40 shrink-0 truncate text-sm text-muted" title={label}>
        {label}
      </div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-16 shrink-0 text-right text-sm tabular-nums">{display ?? value}</div>
    </div>
  );
}

/* ── Stacked proportion bar + legend ────────────────────────────────────── */

const SEG_TONES: Record<string, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  muted: "bg-muted/40",
};

export function Segments({
  segments,
}: {
  segments: { label: string; value: number; tone?: keyof typeof SEG_TONES }[];
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-elevated">
        {segments.map((s, i) => (
          <div
            key={i}
            className={cn(SEG_TONES[s.tone ?? "accent"])}
            style={{ width: `${(s.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className={cn("size-2 rounded-full", SEG_TONES[s.tone ?? "accent"])} />
            <span className="text-muted">{s.label}</span>
            <span className="font-medium tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── View tabs (dashboard view switcher) ────────────────────────────────── */

export function ViewTabs({
  tabs,
  active,
}: {
  tabs: { key: string; label: string; href: string }[];
  active: string;
}) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors",
            t.key === active
              ? "bg-elevated font-medium text-foreground"
              : "text-muted hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

/* ── Kanban (read display) ──────────────────────────────────────────────── */

const PRIORITY_DOT: Record<string, string> = {
  Urgent: "bg-danger",
  High: "bg-warning",
  Medium: "bg-accent",
  Low: "bg-muted/50",
};

export function KanbanBoard({
  columns,
}: {
  columns: { name: string; tasks: { id: number; title: string; priority: string | null; dueDate: string | null; assigneeName: string | null; committee: string | null }[] }[];
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div key={col.name} className="w-72 shrink-0">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-sm font-medium">{col.name}</span>
            <span className="rounded-full bg-elevated px-1.5 text-xs tabular-nums text-muted">
              {col.tasks.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {col.tasks.length === 0 && (
              <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted">
                Empty
              </div>
            )}
            {col.tasks.map((t) => (
              <Card key={t.id} className="p-3">
                <div className="flex items-start gap-2">
                  {t.priority && (
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", PRIORITY_DOT[t.priority] ?? "bg-muted/50")} />
                  )}
                  <div className="min-w-0 flex-1 text-sm">{t.title}</div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                  {t.assigneeName && <span className="truncate">{t.assigneeName}</span>}
                  {t.dueDate && <span className="tabular-nums">· {t.dueDate}</span>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Misc ───────────────────────────────────────────────────────────────── */

export function MetaRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">{children}</div>;
}

export function ListRow({
  href,
  left,
  right,
}: {
  href?: string;
  left: React.ReactNode;
  right?: React.ReactNode;
}) {
  const inner = (
    <div className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-elevated/50">
      <div className="min-w-0">{left}</div>
      {right != null && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
