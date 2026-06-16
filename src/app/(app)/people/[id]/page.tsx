import Link from "next/link";
import { notFound } from "next/navigation";

import { CommitteeDot } from "@/components/committee-select";
import { Badge, Card, EmptyState, PageHeader, SectionCard, buttonSecondary } from "@/components/ui";
import { getCommitteeOptions } from "@/lib/committee-queries";
import { requireModule } from "@/lib/dal";
import { personStatusVariant } from "@/lib/options";
import { getPersonById } from "@/lib/queries";
import { canWrite, isAdmin } from "@/lib/rbac";
import { getMedia, getMemberByStudentId } from "@/lib/workspace-queries";

/** Prefix a bare domain with https:// so user-entered URLs always link out. */
function ensureHttp(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** Drop a leading @ from a social handle. */
function stripAt(handle: string): string {
  return handle.replace(/^@+/, "");
}

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireModule("people");
  const writable = canWrite(me.modules, me.writeModules, "people");
  const { id } = await params;
  const personId = Number(id);
  if (Number.isNaN(personId)) notFound();

  const person = await getPersonById(personId);
  if (!person) notFound();
  // Non-admins can't reach a hidden person's page even by guessing the id.
  if (person.adminOnly && !isAdmin(me.modules)) notFound();

  const [member, committees, photos] = await Promise.all([
    getMemberByStudentId(person.studentId),
    getCommitteeOptions(),
    getMedia("person", personId),
  ]);
  const committeeColor = committees.find((c) => c.name === person.committee)?.color;
  const photoUrl = photos.find((m) => m.role === "photo")?.webpUrl;

  // Contact + social links, in display order. `href: null` renders as plain text
  // (Discord has no canonical profile URL); only present fields are shown.
  const links = (
    [
      person.email && { label: "Email", value: person.email, href: `mailto:${person.email}` },
      person.website && { label: "Website", value: person.website, href: ensureHttp(person.website) },
      person.linkedin && { label: "LinkedIn", value: person.linkedin, href: ensureHttp(person.linkedin) },
      person.github && {
        label: "GitHub",
        value: person.github,
        href: `https://github.com/${stripAt(person.github)}`,
      },
      person.instagram && {
        label: "Instagram",
        value: person.instagram,
        href: `https://instagram.com/${stripAt(person.instagram)}`,
      },
      person.discord && { label: "Discord", value: person.discord, href: null },
    ].filter(Boolean) as { label: string; value: string; href: string | null }[]
  );

  return (
    <>
      <PageHeader
        title={person.name}
        description={person.roleTitle ?? undefined}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "People", href: "/people" },
          { label: person.name },
        ]}
        action={
          writable ? (
            <Link href={`/people/${personId}/edit`} className={buttonSecondary}>
              Edit
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 flex items-center gap-4">
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={person.name}
            className="size-16 shrink-0 rounded-lg border border-border object-cover"
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {person.type && <Badge variant="neutral">{person.type}</Badge>}
          <Badge variant={personStatusVariant(person.status)}>{person.status ?? "—"}</Badge>
          {person.adminOnly && <Badge variant="warning">Hidden from non-admins</Badge>}
          {person.showOnWebsite && <Badge variant="success">On website</Badge>}
          {person.committee && (
            <span className="flex items-center gap-1.5 text-sm text-muted">
              <CommitteeDot color={committeeColor} />
              {person.committee}
            </span>
          )}
        </div>
      </div>

      {member && (
        <SectionCard title="DUSA club membership" className="mb-6">
          <div className="flex flex-wrap items-center gap-2 px-5 py-4 text-sm">
            <Badge variant={member.isCurrent ? "success" : "neutral"}>
              {member.isCurrent ? "Current member" : "Lapsed"}
            </Badge>
            <Badge variant={member.dusaMember ? "success" : "neutral"}>
              {member.dusaMember ? "DUSA member" : "Non-DUSA"}
            </Badge>
            <span className="text-muted">
              {[member.faculty, member.campus, member.membershipType]
                .filter(Boolean)
                .join(" · ") || "—"}
            </span>
          </div>
        </SectionCard>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Meta
          label="Committee"
          value={
            person.committee ? (
              <span className="flex items-center gap-1.5">
                <CommitteeDot color={committeeColor} />
                {person.committee}
              </span>
            ) : (
              "—"
            )
          }
        />
        <Meta label="Student ID" value={person.studentId ?? "—"} />
      </div>

      <SectionCard title="Contact & links">
        {links.length === 0 ? (
          <EmptyState>No contact details on file.</EmptyState>
        ) : (
          <dl className="divide-y divide-border">
            {links.map((l) => (
              <div key={l.label} className="flex items-center justify-between gap-4 px-5 py-3">
                <dt className="shrink-0 text-sm text-muted">{l.label}</dt>
                <dd className="min-w-0 truncate text-sm">
                  {l.href ? (
                    <a
                      href={l.href}
                      target={l.href.startsWith("mailto:") ? undefined : "_blank"}
                      rel="noreferrer"
                      className="text-accent-text hover:underline"
                    >
                      {l.value}
                    </a>
                  ) : (
                    l.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </SectionCard>

      {person.notes && (
        <SectionCard title="Notes" className="mt-6">
          <p className="whitespace-pre-wrap p-5 text-sm text-foreground/90">{person.notes}</p>
        </SectionCard>
      )}
    </>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1.5 text-sm">{value}</div>
    </Card>
  );
}
