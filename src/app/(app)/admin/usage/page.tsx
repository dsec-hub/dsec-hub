import { StatTile } from "@/components/dashboard";
import { Badge, EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { requireAdmin } from "@/lib/dal";
import { formatDate } from "@/lib/format";
import { getRecentActivity, getUsageByMember, getUsageSummary } from "@/lib/workspace-queries";

export default async function UsageStatsPage() {
  await requireAdmin();
  const [summary, byMember, recent] = await Promise.all([
    getUsageSummary(),
    getUsageByMember(),
    getRecentActivity(30),
  ]);

  return (
    <>
      <PageHeader
        title="Usage statistics"
        description="Tracks every dashboard access and MCP call, per member."
      />

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Total events" value={summary.total} accent />
          <StatTile label="Active members" value={summary.activeMembers} sub="distinct actors" />
          <StatTile label="MCP calls" value={summary.mcp} sub={`${summary.dashboard} dashboard`} />
          <StatTile label="Today" value={summary.today} sub="events so far" />
        </div>

        <SectionCard title="By member">
          {byMember.length === 0 ? (
            <EmptyState>No member activity recorded yet.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-5 py-3 font-medium">Member</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 text-right font-medium">Dashboard</th>
                    <th className="px-5 py-3 text-right font-medium">MCP</th>
                    <th className="px-5 py-3 text-right font-medium">Creates</th>
                    <th className="px-5 py-3 text-right font-medium">Updates</th>
                    <th className="px-5 py-3 text-right font-medium">Total</th>
                    <th className="px-5 py-3 text-right font-medium">Last active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {byMember.map((m, i) => (
                    <tr key={i} className="transition-colors hover:bg-elevated/50">
                      <td className="px-5 py-3 font-medium">{m.actorLabel ?? "—"}</td>
                      <td className="px-5 py-3">
                        <Badge variant={m.actorType === "user" ? "accent" : "neutral"}>
                          {m.actorType}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted">{m.dashboard}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted">{m.mcp}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted">{m.creates}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted">{m.updates}</td>
                      <td className="px-5 py-3 text-right font-medium tabular-nums">{m.total}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted">
                        {formatDate(m.lastActive)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Recent activity">
          {recent.length === 0 ? (
            <EmptyState>No activity yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-elevated/50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Badge variant={r.source === "mcp" ? "accent" : "neutral"}>{r.source}</Badge>
                    <div className="min-w-0">
                      <div className="truncate text-sm">
                        <span className="font-medium">{r.actorLabel ?? "Unknown"}</span>
                        <span className="text-muted"> · {r.action}</span>
                      </div>
                      {r.path && (
                        <div className="mt-0.5 truncate text-xs text-muted">{r.path}</div>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {formatDate(r.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
