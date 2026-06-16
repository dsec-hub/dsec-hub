import { cn } from "@/lib/format";

// Shared loading-skeleton primitives. These are plain Server Components (no
// client JS) rendered by the per-route `loading.tsx` files, so each page shows
// a placeholder shaped like its real content while the server fetches data.
// Every composed skeleton wraps its tree in `animate-pulse` + `aria-hidden`, so
// the individual `Block`s don't each need their own animation.

/** A single shimmer rectangle. Defaults to the rounded `bg-elevated` tone the
 *  app uses for inert surfaces. */
function Block({ className }: { className?: string }) {
  return <div className={cn("rounded bg-elevated", className)} />;
}

/** Mirrors `PageHeader`: optional breadcrumb, a title, a description line, and
 *  an optional right-aligned action button. */
function HeaderBlock({
  breadcrumb = false,
  action = false,
}: {
  breadcrumb?: boolean;
  action?: boolean;
}) {
  return (
    <div className="mb-8">
      {breadcrumb && <Block className="mb-2 h-3 w-48 bg-elevated/60" />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Block className="h-6 w-44" />
          <Block className="mt-2 h-4 w-72 max-w-full bg-elevated/60" />
        </div>
        {action && <Block className="h-8 w-24" />}
      </div>
    </div>
  );
}

/** A row of stat cards — `grid-cols-2 lg:grid-cols-4`, matching `StatCard`. */
function StatGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface p-5">
          <Block className="h-7 w-16" />
          <Block className="mt-2 h-4 w-24 bg-elevated/60" />
        </div>
      ))}
    </div>
  );
}

/** A `SectionCard` whose body is a table: header bar, column headings, and a
 *  set of two-line rows. */
function TableCard({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-5 py-3.5">
        <Block className="h-4 w-32" />
      </div>
      <div className="flex items-center gap-6 border-b border-border px-5 py-2.5">
        <Block className="h-3 w-24 bg-elevated/60" />
        <Block className="h-3 w-20 bg-elevated/60" />
        <Block className="ml-auto h-3 w-16 bg-elevated/60" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <Block className="h-4 w-40" />
              <Block className="mt-1.5 h-3 w-56 max-w-full bg-elevated/60" />
            </div>
            <Block className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A `SectionCard` whose body is a simple divided list (no column headings). */
function ListCard({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-5 py-3.5">
        <Block className="h-4 w-32" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <Block className="h-4 w-36" />
              <Block className="mt-1.5 h-3 w-48 max-w-full bg-elevated/60" />
            </div>
            <Block className="h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Composed, per-page-shape skeletons ──────────────────────────────────── */

/** List/index pages: header, filter + search toolbar, and a table. */
export function ListSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      <HeaderBlock action />
      <div className="mb-6 mt-2 flex flex-wrap items-center justify-between gap-3">
        <Block className="h-9 w-48 rounded-lg" />
        <Block className="h-9 w-64 max-w-full rounded-md" />
      </div>
      <TableCard />
    </div>
  );
}

/** The landing overview: stat cards above a two-column grid of list cards. */
export function OverviewSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      <HeaderBlock />
      <div className="mb-8">
        <StatGrid count={4} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ListCard />
        <ListCard />
      </div>
    </div>
  );
}

/** The dashboard: header, view tabs, stat tiles, then a couple of section cards. */
export function DashboardSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      <HeaderBlock />
      <Block className="mb-6 h-10 w-full max-w-md rounded-lg" />
      <div className="mb-6">
        <StatGrid count={4} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ListCard rows={5} />
        <ListCard rows={5} />
      </div>
    </div>
  );
}

/** Detail/show pages: breadcrumb header, status badges, a meta grid, and a
 *  couple of content section cards. */
export function DetailSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      <HeaderBlock breadcrumb action />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Block className="h-5 w-20 rounded-full" />
        <Block className="h-5 w-24 rounded-full" />
        <Block className="h-5 w-16 rounded-full" />
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <Block className="h-3 w-16 bg-elevated/60" />
            <Block className="mt-2 h-4 w-24" />
          </div>
        ))}
      </div>
      <div className="space-y-6">
        <SectionShell lines={3} />
        <SectionShell lines={2} />
      </div>
    </div>
  );
}

/** Create/edit form pages: breadcrumb header and a card of labelled fields. */
export function FormSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      <HeaderBlock breadcrumb action />
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={cn(i % 3 === 0 && "sm:col-span-2")}>
              <Block className="h-3 w-24 bg-elevated/60" />
              <Block className="mt-2 h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-end gap-2 border-t border-border pt-5">
          <Block className="h-9 w-20 rounded-md" />
          <Block className="h-9 w-28 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/** A bare section card with a header bar and a few body lines. */
function SectionShell({ lines = 3 }: { lines?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-5 py-3.5">
        <Block className="h-4 w-28" />
      </div>
      <div className="space-y-3 p-5">
        {Array.from({ length: lines }).map((_, i) => (
          <Block key={i} className="h-4 w-full bg-elevated/60" />
        ))}
      </div>
    </div>
  );
}
