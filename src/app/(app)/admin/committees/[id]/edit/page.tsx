import { notFound } from "next/navigation";

import { UndoButton } from "@/components/undo-button";
import { PageHeader, buttonGhost } from "@/components/ui";
import { committeeUsage, getCommitteeById } from "@/lib/committee-queries";
import { cn } from "@/lib/format";
import { getPeopleOptions } from "@/lib/queries";

import { deleteCommittee, updateCommittee } from "../../actions";
import { CommitteeForm } from "../../committee-form";

export default async function EditCommitteePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const committeeId = Number(id);
  if (Number.isNaN(committeeId)) notFound();

  const committee = await getCommitteeById(committeeId);
  if (!committee) notFound();

  const [people, usage] = await Promise.all([
    getPeopleOptions(),
    committeeUsage(committee.name),
  ]);
  const canDelete = usage === 0;

  return (
    <>
      <PageHeader
        title="Edit committee"
        description={committee.name}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Committees", href: "/admin/committees" },
          { label: committee.name },
        ]}
        action={
          canDelete ? (
            <UndoButton
              action={deleteCommittee.bind(null, committeeId)}
              confirm="Delete this committee permanently?"
              redirectTo="/admin/committees"
              className={cn(buttonGhost, "text-danger hover:text-danger")}
            >
              Delete
            </UndoButton>
          ) : undefined
        }
      />
      {!canDelete && (
        <p className="mb-5 max-w-2xl rounded-lg border border-border bg-surface px-4 py-3 text-xs text-muted">
          In use by {usage} record{usage === 1 ? "" : "s"} across people, events, and tasks.
          Renaming cascades everywhere; switch off <span className="text-foreground">Active</span> to
          retire it. To delete, reassign those records first.
        </p>
      )}
      <CommitteeForm
        action={updateCommittee.bind(null, committeeId)}
        committee={committee}
        people={people}
        redirectOnSuccess="/admin/committees"
      />
    </>
  );
}
