import Link from "next/link";

import { Badge, EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { cn } from "@/lib/format";
import {
  PARTNER_STATUSES,
  PARTNER_STATUS_LABELS,
  partnerStatusVariant,
} from "@/lib/options";
import { canWrite } from "@/lib/rbac";
import { getMedia, getPartnerById, getPartners } from "@/lib/workspace-queries";

import { NewPartnerButton, type CreatedPartner } from "./new-partner-button";

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; status?: string }>;
}) {
  const me = await requireModule("partners");
  const writable = canWrite(me.modules, me.writeModules, "partners");
  const sp = await searchParams;
  const allPartners = await getPartners();

  // Status filter pills (?status=lead|contacted|active|inactive). Counts come
  // from the full list so the pills always show the true totals.
  const activeStatus = PARTNER_STATUSES.find((s) => s === sp.status) ?? null;
  const counts = allPartners.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});
  const partners = activeStatus
    ? allPartners.filter((p) => p.status === activeStatus)
    : allPartners;

  const pills = [
    { value: null as string | null, label: "All", count: allPartners.length },
    ...PARTNER_STATUSES.map((s) => ({
      value: s as string | null,
      label: PARTNER_STATUS_LABELS[s],
      count: counts[s] ?? 0,
    })),
  ];

  // After the create modal inserts a partner it sets ?created=ID; we load that
  // partner's logo here so the modal's stage-2 logo card shows live data (the
  // MediaManager action revalidates /partners, re-running this).
  const createdId = writable ? Number(sp.created) : NaN;
  let created: CreatedPartner | null = null;
  if (writable && Number.isFinite(createdId)) {
    const partner = await getPartnerById(createdId);
    if (partner) {
      const media = await getMedia("partner", createdId);
      created = { id: createdId, name: partner.name, media };
    }
  }

  return (
    <>
      <PageHeader
        title="Partners"
        description="Collaborator clubs and partner orgs that co-host events"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Partners" }]}
        action={writable ? <NewPartnerButton created={created} /> : undefined}
      />

      {allPartners.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {pills.map((pill) => {
            const selected = pill.value === activeStatus;
            return (
              <Link
                key={pill.label}
                href={pill.value ? `/partners?status=${pill.value}` : "/partners"}
                scroll={false}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  selected
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-surface text-muted hover:text-foreground",
                )}
              >
                {pill.label}
                <span
                  className={cn(
                    "tabular-nums",
                    selected ? "text-accent-foreground/80" : "text-muted/70",
                  )}
                >
                  {pill.count}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {partners.length === 0 ? (
        <SectionCard title="Partners">
          <EmptyState>
            {allPartners.length > 0
              ? `No ${activeStatus ? PARTNER_STATUS_LABELS[activeStatus].toLowerCase() : ""} partners.`
              : writable
                ? "No partners yet — add a collaborator club, then link it to the events you run together."
                : "No partners yet."}
          </EmptyState>
        </SectionCard>
      ) : (
        <SectionCard
          title={`${activeStatus ? PARTNER_STATUS_LABELS[activeStatus] : "All"} partners · ${partners.length}`}
        >
          <ul className="divide-y divide-border">
            {partners.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/partners/${p.id}`}
                  className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-elevated/50"
                >
                  <div className="grid size-11 shrink-0 place-items-center rounded-md border border-border bg-elevated">
                    {p.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.logo} alt={`${p.name} logo`} className="max-h-9 max-w-9 object-contain" />
                    ) : (
                      <span className="text-[10px] text-muted">No logo</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{p.name}</span>
                      <Badge variant={partnerStatusVariant(p.status)}>
                        {PARTNER_STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                      {p.showOnWebsite && <Badge variant="success">Public</Badge>}
                    </div>
                    {(p.email || p.website) && (
                      <div className="truncate text-xs text-muted">
                        {[p.email, p.website].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </>
  );
}
