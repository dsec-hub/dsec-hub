import { notFound } from "next/navigation";

import { UndoButton } from "@/components/undo-button";
import { PageHeader, buttonGhost } from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { cn } from "@/lib/format";
import { getEventOptions, getFinanceById } from "@/lib/queries";
import { canWrite } from "@/lib/rbac";

import { archiveFinance, deleteFinance, updateFinance } from "../../actions";
import { FinanceForm } from "../../finance-form";

export default async function EditFinancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireModule("finance");
  const writable = canWrite(me.modules, me.writeModules, "finance");
  const { id } = await params;
  const financeId = Number(id);
  if (Number.isNaN(financeId)) notFound();

  const [entry, events] = await Promise.all([
    getFinanceById(financeId),
    getEventOptions(),
  ]);
  if (!entry) notFound();

  return (
    <>
      <PageHeader
        title="Edit finance item"
        description={entry.item}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Finance", href: "/finance" },
          { label: entry.item },
        ]}
        action={
          <div className="flex items-center gap-2">
            {writable && (
              <UndoButton action={archiveFinance.bind(null, financeId)} redirectTo="/finance" className={buttonGhost}>
                Archive
              </UndoButton>
            )}
            {writable && (
              <UndoButton action={deleteFinance.bind(null, financeId)} confirm="Delete this entry permanently?" redirectTo="/finance" className={cn(buttonGhost, "text-danger hover:text-danger")}>
                Delete
              </UndoButton>
            )}
          </div>
        }
      />
      <FinanceForm
        action={updateFinance.bind(null, financeId)}
        events={events}
        entry={entry}
        canWrite={writable}
        redirectOnSuccess="/finance"
      />
    </>
  );
}
