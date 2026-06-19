import { notFound } from "next/navigation";

import { UndoButton } from "@/components/undo-button";
import { MediaManager } from "@/components/media-manager";
import { PublishToggle } from "@/components/publish-toggle";
import { PageHeader, buttonGhost } from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { cn } from "@/lib/format";
import { canWrite } from "@/lib/rbac";
import { getProjectOwners } from "@/lib/owners";
import { getEventOptions, getMedia, getPersonOptions, getProjectById } from "@/lib/workspace-queries";

import { archiveProject, deleteProject, setProjectPublished, updateProject } from "../../actions";
import { ProjectForm } from "../../project-form";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireModule("projects");
  const writable = canWrite(me.modules, me.writeModules, "projects");
  const { id } = await params;
  const projectId = Number(id);
  if (Number.isNaN(projectId)) notFound();

  const [project, people, events, media, coOwners] = await Promise.all([
    getProjectById(projectId),
    getPersonOptions(),
    getEventOptions(),
    getMedia("project", projectId),
    getProjectOwners(projectId),
  ]);
  if (!project) notFound();

  return (
    <>
      <PageHeader
        title="Edit project"
        description={project.name}
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
                action={setProjectPublished.bind(null, projectId)}
              />
              <UndoButton action={archiveProject.bind(null, projectId)} redirectTo="/projects" className={buttonGhost}>
                Archive
              </UndoButton>
              <UndoButton action={deleteProject.bind(null, projectId)} confirm="Delete this project permanently?" redirectTo="/projects" className={cn(buttonGhost, "text-danger hover:text-danger")}>
                Delete
              </UndoButton>
            </div>
          )
        }
      />
      <ProjectForm
        action={updateProject.bind(null, projectId)}
        project={project}
        people={people}
        events={events}
        coOwnerIds={coOwners.map((o) => o.id)}
        redirectOnSuccess="/projects"
        canWrite={writable}
      />
      <div className="mt-6">
        <MediaManager
          entityType="project"
          entityId={projectId}
          existing={media}
          canWrite={writable}
        />
      </div>
    </>
  );
}
