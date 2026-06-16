import { notFound } from "next/navigation";

import { MediaManager } from "@/components/media-manager";
import { UndoButton } from "@/components/undo-button";
import { Badge, PageHeader, SectionCard, buttonGhost } from "@/components/ui";
import { getCommitteeOptions } from "@/lib/committee-queries";
import { requireModule } from "@/lib/dal";
import { cn } from "@/lib/format";
import { getPersonById } from "@/lib/queries";
import { canWrite, isAdmin } from "@/lib/rbac";
import { getMedia, getMemberByStudentId } from "@/lib/workspace-queries";

import { archivePerson, deletePerson, updatePerson } from "../../actions";
import { PersonForm } from "../../person-form";

export default async function EditPersonPage({
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
  // Non-admins can't reach a hidden person's edit page even by guessing the id.
  if (person.adminOnly && !isAdmin(me.modules)) notFound();

  const [member, committees, photos] = await Promise.all([
    getMemberByStudentId(person.studentId),
    getCommitteeOptions(),
    getMedia("person", personId),
  ]);

  return (
    <>
      <PageHeader
        title="Edit person"
        description={person.name}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "People", href: "/people" },
          { label: person.name },
        ]}
        action={
          <div className="flex items-center gap-2">
            {writable && (
              <UndoButton action={archivePerson.bind(null, personId)} redirectTo="/people" className={buttonGhost}>
                Archive
              </UndoButton>
            )}
            {writable && (
              <UndoButton action={deletePerson.bind(null, personId)} confirm="Delete this person permanently?" redirectTo="/people" className={cn(buttonGhost, "text-danger hover:text-danger")}>
                Delete
              </UndoButton>
            )}
          </div>
        }
      />
      {member ? (
        <div className="mb-6">
          <SectionCard title="DUSA club membership">
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
        </div>
      ) : null}
      <PersonForm action={updatePerson.bind(null, personId)} person={person} committees={committees} canWrite={writable} isAdmin={isAdmin(me.modules)} redirectOnSuccess="/people" />
      <div className="mt-6">
        <MediaManager
          entityType="person"
          entityId={personId}
          existing={photos}
          canWrite={writable}
        />
      </div>
    </>
  );
}
