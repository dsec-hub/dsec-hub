import Link from "next/link";

import { getSponsorLeads } from "@/lib/queries";
import { requireModule } from "@/lib/dal";
import { canWrite } from "@/lib/rbac";
import { Badge, EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { leadStatusVariant } from "@/lib/options";

import { LeadActions } from "./lead-actions";

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Converted", value: "converted" },
  { label: "Closed", value: "closed" },
];

function formatSource(source: string) {
  switch (source) {
    case "pricing_unlock":
      return "Pricing unlock";
    case "enquiry":
      return "Enquiry form";
    case "cal_booking":
      return "Cal.com booking";
    default:
      return source;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const me = await requireModule("sponsors");
  const writable = canWrite(me.modules, me.writeModules, "sponsors");
  const { status } = await searchParams;
  const leads = await getSponsorLeads(status || undefined);

  return (
    <>
      <PageHeader
        title="Sponsor Leads"
        description="Inbound enquiries from the public website and Cal.com bookings"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sponsors", href: "/sponsors" },
          { label: "Leads" },
        ]}
      />

      <div className="mb-4 flex gap-3 border-b border-border pb-4">
        <Link href="/sponsors" className="text-sm text-muted transition-colors hover:text-foreground">
          Pipeline
        </Link>
        <Link href="/sponsors/packages" className="text-sm text-muted transition-colors hover:text-foreground">
          Packages
        </Link>
        <Link href="/sponsors/leads" className="text-sm font-medium text-foreground">
          Leads
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const href = tab.value ? `/sponsors/leads?status=${tab.value}` : "/sponsors/leads";
          const active = (status ?? "") === tab.value;
          return (
            <a
              key={tab.value}
              href={href}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-accent/10 text-accent-text"
                  : "bg-elevated text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      <SectionCard title={`Leads · ${leads.length}`}>
        {leads.length === 0 ? (
          <EmptyState>
            {status
              ? `No ${status} leads.`
              : "No leads yet — they will appear here as visitors enquire on the website."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {leads.map((lead) => (
              <li key={lead.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {lead.name || lead.email}
                      </span>
                      {lead.name && (
                        <span className="text-xs text-muted">{lead.email}</span>
                      )}
                      <Badge variant={leadStatusVariant(lead.status)}>
                        {lead.status}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                      {lead.company && <span>{lead.company}</span>}
                      {lead.tier && <span>Tier: {lead.tier}</span>}
                      {lead.phone && <span>{lead.phone}</span>}
                      {lead.budget && <span>Budget: {lead.budget}</span>}
                      <span>{formatSource(lead.source)}</span>
                      <span>{formatDate(lead.createdAt)}</span>
                    </div>
                    {lead.message && (
                      <p className="mt-1.5 text-xs text-muted/80 line-clamp-2">{lead.message}</p>
                    )}
                    {lead.notes && (
                      <p className="mt-1 rounded bg-elevated px-2 py-1 text-xs text-muted">
                        Note: {lead.notes}
                      </p>
                    )}
                  </div>
                  <LeadActions lead={lead} canWrite={writable} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
