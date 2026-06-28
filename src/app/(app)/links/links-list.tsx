"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Icons } from "@/components/icons";
import { Modal } from "@/components/modal";
import { Badge, EmptyState, buttonPrimary } from "@/components/ui";
import { cn } from "@/lib/format";
import { LINK_ACCENT_SWATCH } from "@/lib/options";
import { showUndoToast } from "@/lib/use-undo-toast";
import type { LinkRow } from "@/lib/workspace-queries";

import { createLink, deleteLink, reorderLinks, updateLink } from "./actions";
import { LinkForm } from "./link-form";

/** Reconstruct the link's FormData so a single-field tweak (visibility) can go
 * through the same `updateLink` action without losing the row's other values. */
function linkToFormData(l: LinkRow, isVisible: boolean): FormData {
  const fd = new FormData();
  fd.set("title", l.title);
  if (l.subtitle) fd.set("subtitle", l.subtitle);
  fd.set("url", l.url);
  if (l.icon) fd.set("icon", l.icon);
  if (l.accent) fd.set("accent", l.accent);
  if (isVisible) fd.set("is_visible", "on");
  return fd;
}

export function LinksList({ links, canWrite }: { links: LinkRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();

  // Local, optimistic copy re-synced whenever the server data changes (drag,
  // toggle and delete mutate this immediately; the next server render reconciles).
  const [items, setItems] = useState<LinkRow[]>(links);
  const sig = useMemo(
    () => links.map((l) => `${l.id}:${l.displayOrder}:${l.isVisible}:${l.updatedAt}`).join("|"),
    [links],
  );
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) {
    setPrevSig(sig);
    setItems(links);
  }

  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  // null = closed; "new" = create; a LinkRow = editing that link.
  const [modal, setModal] = useState<"new" | LinkRow | null>(null);

  function closeModal() {
    setModal(null);
  }

  function onModalSuccess() {
    setModal(null);
    router.refresh();
  }

  function handleDrop(targetId: number) {
    const from = items.findIndex((l) => l.id === dragId);
    const to = items.findIndex((l) => l.id === targetId);
    setDragId(null);
    setOverId(null);
    if (from === -1 || to === -1 || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    start(async () => {
      await reorderLinks(next.map((l) => l.id));
    });
  }

  function toggleVisible(l: LinkRow) {
    const isVisible = !l.isVisible;
    setItems((xs) => xs.map((x) => (x.id === l.id ? { ...x, isVisible } : x)));
    start(async () => {
      const res = await updateLink(l.id, undefined, linkToFormData(l, isVisible));
      showUndoToast(res, () => router.refresh());
    });
  }

  function remove(l: LinkRow) {
    setItems((xs) => xs.filter((x) => x.id !== l.id));
    start(async () => {
      const res = await deleteLink(l.id);
      showUndoToast(res, () => router.refresh());
    });
  }

  return (
    <>
      {canWrite && (
        <div className="mb-4 flex justify-end">
          <button type="button" className={buttonPrimary} onClick={() => setModal("new")}>
            <Icons.link className="size-4" /> New link
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<Icons.link className="size-8" />}
          action={
            canWrite ? (
              <button type="button" className={buttonPrimary} onClick={() => setModal("new")}>
                Add your first link
              </button>
            ) : undefined
          }
        >
          No links yet. {canWrite ? "Add the buttons that appear on your public link page." : ""}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((l) => {
            const swatch = l.accent ? LINK_ACCENT_SWATCH[l.accent] : null;
            return (
              <li
                key={l.id}
                draggable={canWrite}
                onDragStart={() => canWrite && setDragId(l.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                onDragOver={(e) => {
                  if (!canWrite || dragId == null) return;
                  e.preventDefault();
                  setOverId(l.id);
                }}
                onDrop={() => handleDrop(l.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border bg-surface px-3 py-2.5 transition-colors",
                  overId === l.id && dragId !== l.id ? "border-accent ring-1 ring-accent/40" : "border-border",
                  dragId === l.id && "opacity-40",
                  !l.isVisible && "opacity-70",
                )}
              >
                {canWrite && (
                  <span
                    className="shrink-0 cursor-grab text-muted active:cursor-grabbing"
                    aria-hidden
                    title="Drag to reorder"
                  >
                    <Icons.grip className="size-4" />
                  </span>
                )}

                <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-elevated text-lg">
                  {l.icon || "🔗"}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{l.title}</span>
                    {!l.isVisible && <Badge variant="warning">Hidden</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {l.subtitle ? `${l.subtitle} · ` : ""}
                    {l.url}
                  </div>
                </div>

                <span
                  className="hidden size-4 shrink-0 rounded-full border border-border sm:block"
                  style={swatch ? { backgroundColor: swatch } : undefined}
                  title={l.accent ?? "Auto accent"}
                >
                  {!swatch && (
                    <span className="block size-full rounded-full bg-gradient-to-br from-pink-400 via-yellow-300 to-sky-400" />
                  )}
                </span>

                {canWrite && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleVisible(l)}
                      title={l.isVisible ? "Hide from public page" : "Show on public page"}
                      aria-label={l.isVisible ? "Hide link" : "Show link"}
                      className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-foreground"
                    >
                      {l.isVisible ? <Icons.eye className="size-4" /> : <Icons.eyeOff className="size-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModal(l)}
                      className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-foreground"
                      title="Edit link"
                      aria-label="Edit link"
                    >
                      <Icons.settings className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(l)}
                      className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-danger"
                      title="Delete link"
                      aria-label="Delete link"
                    >
                      <Icons.trash className="size-4" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canWrite && items.length > 1 && (
        <p className="mt-3 text-xs text-muted">Drag the handle to reorder. Lower rows appear lower on the page.</p>
      )}

      <Modal
        open={modal !== null}
        onClose={closeModal}
        title={modal && modal !== "new" ? "Edit link" : "New link"}
      >
        {modal === "new" ? (
          <LinkForm action={createLink} onSuccess={onModalSuccess} onCancel={closeModal} />
        ) : modal ? (
          <LinkForm
            action={updateLink.bind(null, modal.id)}
            link={modal}
            onSuccess={onModalSuccess}
            onCancel={closeModal}
          />
        ) : null}
      </Modal>
    </>
  );
}
