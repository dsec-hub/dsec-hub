import Link from "next/link";

import {
  Badge,
  EmptyState,
  PageHeader,
  SectionCard,
} from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { formatAUD } from "@/lib/format";
import { SPONSOR_STAGES, sponsorStageVariant } from "@/lib/options";
import {
  getNewLeadCount,
  getPeopleOptions,
  getSponsors,
  type SponsorWithContact,
} from "@/lib/queries";
import { canWrite } from "@/lib/rbac";

import { NewSponsorButton } from "./new-sponsor-button";

export default async function SponsorsPage() {
  const me = await requireModule("sponsors");
  const writable = canWrite(me.modules, me.writeModules, "sponsors");
  const [sponsors, people, newLeads] = await Promise.all([
    getSponsors(),
    getPeopleOptions(),
    getNewLeadCount(),
  ]);
  const total = sponsors.reduce((acc, s) => acc + Number(s.valueAud ?? 0), 0);

  const byStage = new Map<string, SponsorWithContact[]>();
  for (const s of sponsors) {
    const key = s.stage ?? "Prospect";
    if (!byStage.has(key)) byStage.set(key, []);
    byStage.get(key)!.push(s);
  }
  const stages = [
    ...new Set<string>([...SPONSOR_STAGES, ...sponsors.map((s) => s.stage ?? "Prospect")]),
  ].filter((st) => byStage.has(st));

  return (
    <>
      <PageHeader
        title="Sponsors"
        description={`Pipeline · ${formatAUD(total)} total value`}
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Sponsors" }]}
        action={writable ? <NewSponsorButton people={people} /> : undefined}
      />

      <div className="mb-4 flex gap-3 border-b border-border pb-4">
        <Link href="/sponsors" className="text-sm font-medium text-foreground">
          Pipeline
        </Link>
        <Link href="/sponsors/packages" className="text-sm text-muted transition-colors hover:text-foreground">
          Packages
        </Link>
        <Link href="/sponsors/leads" className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground">
          Leads
          {newLeads > 0 && (
            <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-xs font-medium text-accent-text">
              {newLeads}
            </span>
          )}
        </Link>
      </div>

      {sponsors.length === 0 ? (
        <SectionCard title="Sponsors">
          <EmptyState>No sponsors yet — add the first lead.</EmptyState>
        </SectionCard>
      ) : (
        <div className="space-y-6">
          {stages.map((stage) => {
            const items = byStage.get(stage)!;
            const stageValue = items.reduce((acc, s) => acc + Number(s.valueAud ?? 0), 0);
            return (
              <SectionCard
                key={stage}
                title={`${stage} · ${items.length}`}
                action={
                  <span className="text-xs tabular-nums text-muted">
                    {formatAUD(stageValue)}
                  </span>
                }
              >
                <ul className="divide-y divide-border">
                  {items.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/sponsors/${s.id}`}
                        className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-elevated/50"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {s.organisation}
                          </div>
                          <div className="truncate text-xs text-muted">
                            {[
                              s.relationshipType === "Partner" ? "Partner" : null,
                              s.tier,
                              s.contactName,
                              (s.supportTypes ?? []).join(", "),
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="text-sm tabular-nums text-muted">
                            {s.valueAud ? formatAUD(s.valueAud) : "in-kind"}
                          </span>
                          <Badge variant={sponsorStageVariant(s.stage)}>
                            {s.stage ?? "—"}
                          </Badge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            );
          })}
        </div>
      )}
    </>
  );
}
