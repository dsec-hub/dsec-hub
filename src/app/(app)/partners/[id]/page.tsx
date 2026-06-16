import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge, EmptyState, PageHeader, SectionCard, buttonSecondary } from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { formatDate } from "@/lib/format";
import { eventStatusVariant } from "@/lib/options";
import { canWrite } from "@/lib/rbac";
import { getMedia, getPartnerById, getPartnerEvents } from "@/lib/workspace-queries";

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireModule("partners");
  const writable = canWrite(me.modules, me.writeModules, "partners");
  const { id } = await params;
  const partnerId = Number(id);
  if (Number.isNaN(partnerId)) notFound();

  const [partner, logo, linkedEvents] = await Promise.all([
    getPartnerById(partnerId),
    getMedia("partner", partnerId),
    getPartnerEvents(partnerId),
  ]);
  if (!partner) notFound();

  const logoUrl = logo[0]?.webpUrl ?? null;

  return (
    <>
      <PageHeader
        title={partner.name}
        description={partner.website ?? undefined}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Partners", href: "/partners" },
          { label: partner.name },
        ]}
        action={
          writable ? (
            <Link href={`/partners/${partnerId}/edit`} className={buttonSecondary}>
              Edit
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6">
        <Badge variant={partner.showOnWebsite ? "success" : "neutral"}>
          {partner.showOnWebsite ? "Public — logo shown on linked events" : "Internal only"}
        </Badge>
      </div>

      <SectionCard title="Profile" className="mb-6">
        <div className="flex items-start gap-5 p-5">
          <div className="grid size-20 shrink-0 place-items-center rounded-lg border border-border bg-elevated">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={`${partner.name} logo`} className="max-h-16 max-w-16 object-contain" />
            ) : (
              <span className="text-[10px] text-muted">No logo</span>
            )}
          </div>
          <div className="min-w-0 space-y-2">
            {partner.website ? (
              <a
                href={partner.website}
                target="_blank"
                rel="noreferrer noopener"
                className="break-all text-sm text-accent-text underline underline-offset-2"
              >
                {partner.website}
              </a>
            ) : (
              <p className="text-sm text-muted">No website</p>
            )}
            {partner.notes && (
              <p className="whitespace-pre-wrap text-sm text-foreground/90">{partner.notes}</p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title={`Linked events · ${linkedEvents.length}`}>
        {linkedEvents.length === 0 ? (
          <EmptyState>
            Not linked to any events yet — add this partner from an event’s edit page.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {linkedEvents.map((ev) => (
              <li key={ev.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/events/${ev.id}`}
                    className="truncate text-sm font-medium hover:text-accent-text"
                  >
                    {ev.name}
                  </Link>
                  <div className="truncate text-xs text-muted">
                    {[ev.role, formatDate(ev.startDate)].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <Badge variant={eventStatusVariant(ev.status)}>{ev.status ?? "—"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
