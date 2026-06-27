import { redirect } from "next/navigation";

import { Icons } from "@/components/icons";
import {
  Badge,
  EmptyState,
  PageHeader,
  SectionCard,
  buttonDanger,
  buttonSecondary,
} from "@/components/ui";
import { UndoButton } from "@/components/undo-button";
import { canSeeArchive, getArchive } from "@/lib/archive";
import { requireUser } from "@/lib/dal";

import { deleteItem, restoreItem } from "./actions";

export const metadata = { title: "Archive" };

export default async function ArchivePage() {
  const user = await requireUser();
  // Gate the page itself (defense in depth — the nav entry is hidden too).
  if (!canSeeArchive(user.modules)) redirect("/dashboard");

  const groups = await getArchive(user);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <PageHeader
        title="Archive"
        description="Archived items are hidden from their sections but never deleted. Restore one to bring it back, or remove it permanently."
      />

      {total === 0 ? (
        <SectionCard title="Archive">
          <EmptyState icon={<Icons.archive className="size-8" />}>
            Nothing is archived. Items you archive from any section show up here, ready to restore.
          </EmptyState>
        </SectionCard>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => {
            const Icon = Icons[group.icon];
            return (
              <SectionCard
                key={group.key}
                title={
                  <span className="flex items-center gap-2">
                    <Icon className="size-4 text-muted" />
                    {group.label}
                    <Badge>{group.items.length}</Badge>
                  </span>
                }
              >
                <ul className="divide-y divide-border">
                  {group.items.map((item) => (
                    <li
                      key={`${item.key}-${item.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{item.title}</div>
                        {item.subtitle && (
                          <div className="truncate text-xs text-muted">{item.subtitle}</div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <UndoButton
                          action={restoreItem.bind(null, item.key, item.id)}
                          className={buttonSecondary}
                          pendingLabel="Restoring…"
                        >
                          Restore
                        </UndoButton>
                        <UndoButton
                          action={deleteItem.bind(null, item.key, item.id)}
                          confirm={`Permanently delete "${item.title}"? You'll have a brief window to undo.`}
                          className={buttonDanger}
                          pendingLabel="Deleting…"
                        >
                          Delete
                        </UndoButton>
                      </div>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            );
          })}
        </div>
      )}
    </>
  );
}
