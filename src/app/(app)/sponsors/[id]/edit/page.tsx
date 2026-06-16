import { notFound } from "next/navigation";

import { MediaManager } from "@/components/media-manager";
import { UndoButton } from "@/components/undo-button";
import { PageHeader, buttonGhost } from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { cn } from "@/lib/format";
import { getPeopleOptions, getSponsorById } from "@/lib/queries";
import { canWrite } from "@/lib/rbac";
import { getMedia } from "@/lib/workspace-queries";

import { archiveSponsor, deleteSponsor, updateSponsor } from "../../actions";
import { SponsorForm } from "../../sponsor-form";

export default async function EditSponsorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireModule("sponsors");
  const writable = canWrite(me.modules, me.writeModules, "sponsors");
  const { id } = await params;
  const sponsorId = Number(id);
  if (Number.isNaN(sponsorId)) notFound();

  const [sponsor, people, logo] = await Promise.all([
    getSponsorById(sponsorId),
    getPeopleOptions(),
    getMedia("sponsor", sponsorId),
  ]);
  if (!sponsor) notFound();

  return (
    <>
      <PageHeader
        title="Edit sponsor"
        description={sponsor.organisation}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sponsors", href: "/sponsors" },
          { label: sponsor.organisation },
        ]}
        action={
          writable ? (
            <div className="flex items-center gap-2">
              <UndoButton action={archiveSponsor.bind(null, sponsorId)} redirectTo="/sponsors" className={buttonGhost}>
                Archive
              </UndoButton>
              <UndoButton action={deleteSponsor.bind(null, sponsorId)} confirm="Delete this sponsor permanently?" redirectTo="/sponsors" className={cn(buttonGhost, "text-danger hover:text-danger")}>
                Delete
              </UndoButton>
            </div>
          ) : undefined
        }
      />
      <SponsorForm
        action={updateSponsor.bind(null, sponsorId)}
        people={people}
        sponsor={sponsor}
        redirectOnSuccess="/sponsors"
        canWrite={writable}
      />
      <div className="mt-6 max-w-2xl">
        <MediaManager
          entityType="sponsor"
          entityId={sponsorId}
          existing={logo}
          canWrite={writable}
        />
      </div>
    </>
  );
}
