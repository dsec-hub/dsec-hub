import Link from "next/link";

import { Badge, EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { canWrite } from "@/lib/rbac";
import { getMedia, getPartnerById, getPartners } from "@/lib/workspace-queries";

import { NewPartnerButton, type CreatedPartner } from "./new-partner-button";

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const me = await requireModule("partners");
  const writable = canWrite(me.modules, me.writeModules, "partners");
  const partners = await getPartners();

  // After the create modal inserts a partner it sets ?created=ID; we load that
  // partner's logo here so the modal's stage-2 logo card shows live data (the
  // MediaManager action revalidates /partners, re-running this).
  const createdId = writable ? Number((await searchParams).created) : NaN;
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

      {partners.length === 0 ? (
        <SectionCard title="Partners">
          <EmptyState>
            {writable
              ? "No partners yet — add a collaborator club, then link it to the events you run together."
              : "No partners yet."}
          </EmptyState>
        </SectionCard>
      ) : (
        <SectionCard title={`All partners · ${partners.length}`}>
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
                      {p.showOnWebsite && <Badge variant="success">Public</Badge>}
                    </div>
                    {p.website && (
                      <div className="truncate text-xs text-muted">{p.website}</div>
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
