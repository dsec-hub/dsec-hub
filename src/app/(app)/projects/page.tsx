import Link from "next/link";
import { redirect } from "next/navigation";

import { StatTile } from "@/components/dashboard";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import type { BadgeVariant } from "@/lib/options";
import { canWrite } from "@/lib/rbac";
import { projectScope } from "@/lib/scope";
import {
  getEventOptions,
  getMedia,
  getPersonOptions,
  getProjectById,
  getProjects,
  getProjectStats,
} from "@/lib/workspace-queries";

import { NewProjectButton, type CreatedProject } from "./new-project-button";

function projectStatusVariant(status: string | null | undefined): BadgeVariant {
  switch (status) {
    case "Completed":
    case "Showcased":
      return "success";
    case "In Progress":
    case "Active":
      return "accent";
    case "Planning":
    case "Concept":
    case "Idea":
      return "warning";
    case "Cancelled":
    case "Archived":
      return "danger";
    default:
      return "neutral";
  }
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const me = await requireUser();
  // Module access → all projects; a lead without the module → only theirs
  // (read-only); neither → bounce. See lib/scope.ts.
  const scope = await projectScope(me);
  if (scope === "none") redirect("/dashboard");
  const full = scope === "full";
  const writable = full && canWrite(me.modules, me.writeModules, "projects");

  const projects = await getProjects(full ? {} : { leadId: me.personId ?? -1 });
  // Stats span ALL projects, so only show them to module-holders (a scoped lead
  // must not learn the totals). Option lists are only needed for the New form.
  const stats = full ? await getProjectStats() : null;
  const [people, events] = writable
    ? await Promise.all([getPersonOptions(), getEventOptions()])
    : [[], []];

  // After the create modal inserts a project it sets ?created=ID; load its images
  // so the modal's stage-2 card shows live data (uploads revalidate /projects).
  const createdId = writable ? Number((await searchParams).created) : NaN;
  let created: CreatedProject | null = null;
  if (writable && Number.isFinite(createdId)) {
    const proj = await getProjectById(createdId);
    if (proj) {
      const media = await getMedia("project", createdId);
      created = { id: createdId, name: proj.name, media };
    }
  }

  return (
    <>
      <PageHeader
        title="Projects"
        description={
          full
            ? "What the club is building — community projects, tools, and showcases."
            : "The projects you lead."
        }
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Projects" }]}
        action={writable && <NewProjectButton people={people} events={events} created={created} />}
      />

      {stats && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <StatTile label="Total" value={stats.total} accent />
          <StatTile label="Published" value={stats.public} sub="live on the site" />
          <StatTile label="Shipped" value={stats.shipped} tone="success" sub="completed or showcased" />
        </div>
      )}

      {projects.length === 0 ? (
        <Card>
          <EmptyState>
            {full ? "No projects yet — add the first one." : "You don't lead any projects yet."}
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="relative flex h-full flex-col p-5 transition-colors hover:border-accent/50"
            >
              <Link
                href={`/projects/${p.id}`}
                aria-label={`View ${p.name}`}
                className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              />
              {p.category && (
                <div className="text-xs uppercase tracking-wide text-muted">{p.category}</div>
              )}
              <div className="mt-1 font-medium">{p.name}</div>
              {p.summary && (
                <p className="mt-1.5 line-clamp-2 text-sm text-muted">{p.summary}</p>
              )}

              {p.techTags && p.techTags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.techTags.map((tag) => (
                    <Badge key={tag} variant="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {(p.repoUrl || p.demoUrl) && (
                <div className="relative z-10 mt-3 flex flex-wrap gap-3 text-xs">
                  {p.repoUrl && (
                    <a
                      href={p.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted transition-colors hover:text-foreground"
                    >
                      Repo ↗
                    </a>
                  )}
                  {p.demoUrl && (
                    <a
                      href={p.demoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted transition-colors hover:text-foreground"
                    >
                      Demo ↗
                    </a>
                  )}
                </div>
              )}

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {!p.isPublic && <Badge variant="warning">Draft</Badge>}
                  <Badge variant={projectStatusVariant(p.status)}>{p.status ?? "—"}</Badge>
                  {p.featured && (
                    <span className="text-accent-text" title="Featured" aria-label="Featured">
                      ★
                    </span>
                  )}
                </div>
                {p.leadName && (
                  <span className="truncate text-xs text-muted">{p.leadName}</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
