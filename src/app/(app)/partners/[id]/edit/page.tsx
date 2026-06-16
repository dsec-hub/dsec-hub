import { notFound } from "next/navigation";

import { MediaManager } from "@/components/media-manager";
import { UndoButton } from "@/components/undo-button";
import { PageHeader, buttonGhost } from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { cn } from "@/lib/format";
import { canWrite } from "@/lib/rbac";
import { getMedia, getPartnerById } from "@/lib/workspace-queries";

import { archivePartner, deletePartner, updatePartner } from "../../actions";
import { PartnerForm } from "../../partner-form";

export default async function EditPartnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireModule("partners");
  const writable = canWrite(me.modules, me.writeModules, "partners");
  const { id } = await params;
  const partnerId = Number(id);
  if (Number.isNaN(partnerId)) notFound();

  const [partner, logo] = await Promise.all([
    getPartnerById(partnerId),
    getMedia("partner", partnerId),
  ]);
  if (!partner) notFound();

  return (
    <>
      <PageHeader
        title="Edit partner"
        description={partner.name}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Partners", href: "/partners" },
          { label: partner.name },
        ]}
        action={
          writable ? (
            <div className="flex items-center gap-2">
              <UndoButton action={archivePartner.bind(null, partnerId)} redirectTo="/partners" className={buttonGhost}>
                Archive
              </UndoButton>
              <UndoButton
                action={deletePartner.bind(null, partnerId)}
                confirm="Delete this partner permanently?"
                redirectTo="/partners"
                className={cn(buttonGhost, "text-danger hover:text-danger")}
              >
                Delete
              </UndoButton>
            </div>
          ) : undefined
        }
      />
      <PartnerForm
        action={updatePartner.bind(null, partnerId)}
        partner={partner}
        redirectOnSuccess="/partners"
        canWrite={writable}
      />
      <div className="mt-6 max-w-2xl">
        <MediaManager
          entityType="partner"
          entityId={partnerId}
          existing={logo}
          canWrite={writable}
        />
      </div>
    </>
  );
}
