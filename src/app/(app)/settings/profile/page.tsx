import { MediaManager } from "@/components/media-manager";
import { Badge, PageHeader, SectionCard } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { ensurePersonForUser } from "@/lib/person-link";
import { getPersonById } from "@/lib/queries";
import { getMedia, getMemberByStudentId } from "@/lib/workspace-queries";

import { deleteOwnPhoto, uploadOwnPhoto } from "../actions";
import { ChangeEmailForm } from "../change-email-form";
import { ProfileForm } from "../profile-form";

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  // Ensure a roster record exists/links for this login (first visit for older
  // accounts), then load it for the form + membership panel.
  const personId = await ensurePersonForUser(user);
  const person = await getPersonById(personId);
  if (!person) throw new Error("Profile record missing after linking.");

  const [member, photos] = await Promise.all([
    getMemberByStudentId(person.studentId),
    getMedia("person", personId),
  ]);

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your account details, shared with the committee roster."
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Profile" }]}
      />

      <div className="mb-6 max-w-2xl">
        <SectionCard title="Club membership">
          {person.studentId ? (
            member ? (
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
            ) : (
              <div className="px-5 py-4 text-sm text-muted">
                No DUSA membership found for student ID{" "}
                <span className="font-medium text-foreground">{person.studentId}</span>. It’ll
                link automatically once you appear in the weekly membership report.
              </div>
            )
          ) : (
            <div className="px-5 py-4 text-sm text-muted">
              Add your student ID below to link your DUSA club membership.
            </div>
          )}
        </SectionCard>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Self-service headshot — owner-scoped upload/delete (no people-write
            needed), the same photo that powers the public team grid + lead
            avatars. */}
        <MediaManager
          entityType="person"
          entityId={personId}
          existing={photos}
          uploadAction={uploadOwnPhoto}
          deleteAction={deleteOwnPhoto}
        />
        <ProfileForm person={person} />
        <ChangeEmailForm currentEmail={user.email} />
      </div>
    </>
  );
}
