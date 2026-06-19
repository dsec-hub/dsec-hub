import Link from "next/link";

import { Sparkline, StatTile } from "@/components/dashboard";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  SectionCard,
  buttonSecondary,
} from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { cn, formatDate } from "@/lib/format";
import { getMemberStats, getMembers } from "@/lib/workspace-queries";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "dusa", label: "DUSA" },
  { key: "non-dusa", label: "Non-DUSA" },
] as const;

function filterHref(key: string, q?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (key !== "all") params.set("filter", key);
  const s = params.toString();
  return s ? `/members?${s}` : "/members";
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  await requireModule("members");
  const { q, filter } = await searchParams;
  const activeFilter = filter === "dusa" || filter === "non-dusa" ? filter : "all";

  const [stats, allRows] = await Promise.all([
    getMemberStats(),
    getMembers({ search: q, dusaOnly: activeFilter === "dusa" }),
  ]);
  const rows = activeFilter === "non-dusa" ? allRows.filter((m) => !m.dusaMember) : allRows;

  const latest = stats.trend[stats.trend.length - 1];

  return (
    <>
      <PageHeader
        title="Members"
        description="Weekly DUSA membership roster — synced automatically each week from the DUSA export."
        action={
          <Link href="/export/members" className={buttonSecondary} prefetch={false}>
            Export CSV
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Current members" value={stats.current} accent sub={`${stats.totalSeen} seen all-time`} />
        <StatTile label="DUSA members" value={stats.dusa} sub={`${Math.round((stats.dusa / (stats.current || 1)) * 100)}% of members`} />
        <StatTile label="Non-DUSA" value={stats.nonDusa} />
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wide text-muted">Weekly trend</div>
          <div className="mt-3">
            <Sparkline data={stats.trend.map((t) => t.totalMembers)} className="h-10" />
          </div>
          <div className="mt-1 text-xs text-muted">
            {latest?.reportDate ? `as at ${formatDate(latest.reportDate)}` : "no reports yet"}
          </div>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={filterHref(f.key, q)}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors",
                f.key === activeFilter
                  ? "bg-elevated font-medium text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <form className="flex items-center gap-2">
          {activeFilter !== "all" && <input type="hidden" name="filter" value={activeFilter} />}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name, student ID, or email"
            className="w-64 max-w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <button type="submit" className={buttonSecondary}>
            Search
          </button>
        </form>
      </div>

      <div className="mt-6">
        <SectionCard
          title={`${rows.length} member${rows.length === 1 ? "" : "s"}`}
          action={q ? <span className="text-xs text-muted">matching “{q}”</span> : undefined}
        >
          {rows.length === 0 ? (
            <EmptyState>
              {q ? `No members match “${q}”.` : "No members on record yet — the roster syncs weekly from DUSA."}
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-5 py-2.5 font-medium">Member</th>
                    <th className="px-5 py-2.5 font-medium">Email</th>
                    <th className="px-5 py-2.5 font-medium">Membership</th>
                    <th className="px-5 py-2.5 font-medium">Type</th>
                    <th className="px-5 py-2.5 text-right font-medium">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((m) => (
                    <tr key={m.id} className="transition-colors hover:bg-elevated/50">
                      <td className="px-5 py-3">
                        <div className="font-medium">{m.fullName ?? "—"}</div>
                        <div className="mt-0.5 text-xs text-muted">
                          {[m.studentId, m.faculty, m.campus].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {m.email ? (
                          <a
                            href={`mailto:${m.email}`}
                            className="text-accent hover:underline"
                          >
                            {m.email}
                          </a>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={m.dusaMember ? "accent" : "neutral"}>
                          {m.dusaMember ? "DUSA" : "Non-DUSA"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-muted">{m.membershipType ?? "—"}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted">
                        {formatDate(m.endDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
