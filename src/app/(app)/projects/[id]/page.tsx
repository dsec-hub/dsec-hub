import Link from "next/link";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/markdown";
import { PublishToggle } from "@/components/publish-toggle";
import { RelatedTasks } from "@/components/related-tasks";
import { Badge, Card, PageHeader, SectionCard, buttonSecondary } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { canAccess, canManageRelatedTasks } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import { getCommitteeOptions } from "@/lib/committee-queries";
import { getEventById } from "@/lib/queries";
import { getProjectOwners } from "@/lib/owners";
import { requireProjectView } from "@/lib/scope";
import { projectStatusVariant } from "@/lib/workspace-options";
import { getPersonOptions, getProjectById, getRelatedTasks } from "@/lib/workspace-queries";

import { setProjectPublished } from "../actions";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireUser();
  const { id } = await params;
  const pid = Number(id);
  if (Number.isNaN(pid)) notFound();
  const project = await getProjectById(pid);
  if (!project) notFound();
  // Access: module-holders see any project; a lead sees the project they lead
  // (read-only); anyone else is bounced. See lib/scope.ts.
  const { writable } = await requireProjectView(me, project);
  // The Tasks card is governed by tasks-write too: a task editor with only view
  // access to projects can manage this project's tasks. Mirror the action's
  // requireModule("projects") gate — a scoped lead without the module can't (the
  // mutation would bounce), so require projects VIEW alongside the write rule.
  const canEditTasks =
    canAccess(me.modules, "projects") &&
    canManageRelatedTasks(me.modules, me.writeModules, "projects");
  const [people, relatedTasks, committees, coLeads] = await Promise.all([
    getPersonOptions(),
    getRelatedTasks("project", pid),
    getCommitteeOptions(),
    getProjectOwners(pid),
  ]);
  const lead = people.find((p) => p.id === project.leadId)?.name;
  // Primary lead first, then co-leads (project_owner). Label flips to plural.
  const allLeadNames = [lead, ...coLeads.map((o) => o.name)].filter(Boolean) as string[];
  // Cross-link: the event this project came out of (if any).
  const relatedEvent = project.relatedEventId ? await getEventById(project.relatedEventId) : null;

  return (
    <>
      <PageHeader
        title={project.name}
        description={project.summary ?? undefined}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Projects", href: "/projects" },
          { label: project.name },
        ]}
        action={
          writable && (
            <div className="flex items-center gap-2">
              <PublishToggle
                published={project.isPublic}
                action={setProjectPublished.bind(null, project.id)}
              />
              <Link href={`/projects/${project.id}/edit`} className={buttonSecondary}>
                Edit
              </Link>
            </div>
          )
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant={project.isPublic ? "success" : "warning"}>
          {project.isPublic ? "Published" : "Draft"}
        </Badge>
        <Badge variant={projectStatusVariant(project.status)}>{project.status ?? "—"}</Badge>
        {project.featured && <span className="text-sm text-accent-text">★ Featured</span>}
        {project.category && <Badge variant="neutral">{project.category}</Badge>}
      </div>

      {project.techTags && project.techTags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-1.5">
          {project.techTags.map((t) => (
            <Badge key={t} variant="neutral">{t}</Badge>
          ))}
        </div>
      )}

      {project.description && (
        <SectionCard title="About" className="mb-6">
          <div className="p-5">
            <Markdown content={project.description} />
          </div>
        </SectionCard>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Meta
          label={allLeadNames.length > 1 ? "Leads" : "Lead"}
          value={allLeadNames.length ? allLeadNames.join(", ") : "—"}
        />
        <Meta label="Timeline" value={`${formatDate(project.startDate)} → ${formatDate(project.endDate)}`} />
        <Meta label="Repository" value={project.repoUrl ? <ExtLink href={project.repoUrl} /> : "—"} />
        <Meta label="Demo" value={project.demoUrl ? <ExtLink href={project.demoUrl} /> : "—"} />
        {relatedEvent && (
          <Meta
            label="From event"
            value={
              <Link href={`/events/${relatedEvent.id}`} className="text-accent-text hover:underline">
                {relatedEvent.name}
              </Link>
            }
          />
        )}
      </div>

      <div className="mt-6">
        <RelatedTasks
          kind="project"
          parentId={project.id}
          tasks={relatedTasks}
          canWrite={canEditTasks}
          committees={committees.map((c) => c.name)}
        />
      </div>

      {project.notes && (
        <SectionCard title="Notes" className="mt-6">
          <div className="p-5">
            <Markdown content={project.notes} />
          </div>
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

function ExtLink({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="break-all text-accent-text underline underline-offset-2">
      {href}
    </a>
  );
}
