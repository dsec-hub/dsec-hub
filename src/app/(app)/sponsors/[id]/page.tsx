import Link from "next/link";
import { notFound } from "next/navigation";

import { RelatedTasks } from "@/components/related-tasks";
import { Badge, EmptyState, PageHeader, SectionCard, StatCard, buttonSecondary } from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { formatAUD, formatDate } from "@/lib/format";
import { sponsorStageVariant } from "@/lib/options";
import { getPeopleOptions, getSponsorById } from "@/lib/queries";
import { canWrite } from "@/lib/rbac";
import { getCommitteeOptions } from "@/lib/committee-queries";
import {
  getSponsorAttachments,
  getSponsorContacts,
  getSponsorEvents,
  getSponsorTasks,
} from "@/lib/workspace-queries";

import { SponsorContacts } from "./sponsor-contacts";
import { SponsorDocuments } from "./sponsor-documents";

export default async function SponsorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireModule("sponsors");
  const writable = canWrite(me.modules, me.writeModules, "sponsors");
  const { id } = await params;
  const sponsorId = Number(id);
  if (Number.isNaN(sponsorId)) notFound();

  const [sponsor, people, contacts, tasks, documents, linkedEvents, committees] = await Promise.all([
    getSponsorById(sponsorId),
    getPeopleOptions(),
    getSponsorContacts(sponsorId),
    getSponsorTasks(sponsorId),
    getSponsorAttachments(sponsorId),
    getSponsorEvents(sponsorId),
    getCommitteeOptions(),
  ]);
  if (!sponsor) notFound();

  const primaryContact = sponsor.contactPersonId
    ? people.find((p) => p.id === sponsor.contactPersonId)?.name ?? null
    : null;
  const supportTypes = sponsor.supportTypes ?? [];
  const openTasks = tasks.filter((t) => t.completedAt == null).length;

  return (
    <>
      <PageHeader
        title={sponsor.organisation}
        description={
          [sponsor.relationshipType ?? "Sponsor", sponsor.tier, primaryContact]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sponsors", href: "/sponsors" },
          { label: sponsor.organisation },
        ]}
        action={
          writable ? (
            <Link href={`/sponsors/${sponsorId}/edit`} className={buttonSecondary}>
              Edit
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Stage">
          <Badge variant={sponsorStageVariant(sponsor.stage)}>{sponsor.stage ?? "—"}</Badge>
        </Card>
        <StatCard label="Value" value={formatAUD(sponsor.valueAud)} hint={sponsor.valueAud ? undefined : "in-kind"} />
        <StatCard label="Open tasks" value={openTasks} />
        <Card label="DUSA approved">
          <Badge variant={sponsor.dusaApproved ? "success" : "neutral"}>
            {sponsor.dusaApproved ? "Yes" : "No"}
          </Badge>
        </Card>
      </div>

      {supportTypes.length > 0 && (
        <SectionCard title="Type of support" className="mb-6">
          <div className="flex flex-wrap gap-2 p-5">
            {supportTypes.map((s) => (
              <Badge key={s} variant="accent">
                {s}
              </Badge>
            ))}
          </div>
        </SectionCard>
      )}

      {sponsor.notes && (
        <SectionCard title="Notes" className="mb-6">
          <p className="whitespace-pre-wrap p-5 text-sm text-foreground/90">{sponsor.notes}</p>
        </SectionCard>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <SponsorContacts sponsorId={sponsorId} contacts={contacts} people={people} canWrite={writable} />
        <RelatedTasks
          kind="sponsor"
          parentId={sponsorId}
          tasks={tasks}
          canWrite={writable}
          committees={committees.map((c) => c.name)}
          defaultCommittee="External Affairs"
        />
        <SectionCard title={`Linked events · ${linkedEvents.length}`}>
          {linkedEvents.length === 0 ? (
            <EmptyState>
              No events linked yet — add this sponsor from an event&apos;s Sponsors section.
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
                      {[ev.status, formatDate(ev.startDate), ev.tier]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <div className="lg:col-span-2">
          <SponsorDocuments sponsorId={sponsorId} documents={documents} canWrite={writable} />
        </div>
      </div>
    </>
  );
}

/** Small labelled tile for non-numeric stats (badges). */
function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div>{children}</div>
      <div className="mt-2 text-sm text-muted">{label}</div>
    </div>
  );
}
