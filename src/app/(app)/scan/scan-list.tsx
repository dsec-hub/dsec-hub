"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Icons } from "@/components/icons";
import { Modal } from "@/components/modal";
import { Badge, EmptyState, buttonPrimary } from "@/components/ui";
import { cn } from "@/lib/format";
import { SCAN_ACCENT_SWATCH } from "@/lib/options";
import { showUndoToast } from "@/lib/use-undo-toast";
import type { ScanTargetRow } from "@/lib/workspace-queries";

import { createScanTarget, deleteScanTarget, reorderScanTargets, updateScanTarget } from "./actions";
import { ScanForm } from "./scan-form";

/** Rebuild the card's FormData so a single-field tweak (visibility) goes through
 * the same `updateScanTarget` action without losing the row's other values. */
function scanToFormData(t: ScanTargetRow, isVisible: boolean): FormData {
  const fd = new FormData();
  fd.set("label", t.label);
  if (t.caption) fd.set("caption", t.caption);
  fd.set("url", t.url);
  if (t.pretty) fd.set("pretty", t.pretty);
  if (t.accent) fd.set("accent", t.accent);
  if (isVisible) fd.set("is_visible", "on");
  return fd;
}

export function ScanList({ targets, canWrite }: { targets: ScanTargetRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();

  // Local, optimistic copy re-synced whenever the server data changes.
  const [items, setItems] = useState<ScanTargetRow[]>(targets);
  const sig = useMemo(
    () => targets.map((t) => `${t.id}:${t.displayOrder}:${t.isVisible}:${t.updatedAt}`).join("|"),
    [targets],
  );
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) {
    setPrevSig(sig);
    setItems(targets);
  }

  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  // null = closed; "new" = create; a ScanTargetRow = editing that card.
  const [modal, setModal] = useState<"new" | ScanTargetRow | null>(null);

  function closeModal() {
    setModal(null);
  }

  function onModalSuccess() {
    setModal(null);
    router.refresh();
  }

  function handleDrop(targetId: number) {
    const from = items.findIndex((t) => t.id === dragId);
    const to = items.findIndex((t) => t.id === targetId);
    setDragId(null);
    setOverId(null);
    if (from === -1 || to === -1 || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    start(async () => {
      await reorderScanTargets(next.map((t) => t.id));
    });
  }

  function toggleVisible(t: ScanTargetRow) {
    const isVisible = !t.isVisible;
    setItems((xs) => xs.map((x) => (x.id === t.id ? { ...x, isVisible } : x)));
    start(async () => {
      const res = await updateScanTarget(t.id, undefined, scanToFormData(t, isVisible));
      showUndoToast(res, () => router.refresh());
    });
  }

  function remove(t: ScanTargetRow) {
    setItems((xs) => xs.filter((x) => x.id !== t.id));
    start(async () => {
      const res = await deleteScanTarget(t.id);
      showUndoToast(res, () => router.refresh());
    });
  }

  return (
    <>
      {canWrite && (
        <div className="mb-4 flex justify-end">
          <button type="button" className={buttonPrimary} onClick={() => setModal("new")}>
            <Icons.camera className="size-4" /> New card
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<Icons.camera className="size-8" />}
          action={
            canWrite ? (
              <button type="button" className={buttonPrimary} onClick={() => setModal("new")}>
                Add your first card
              </button>
            ) : undefined
          }
        >
          No QR cards yet.{" "}
          {canWrite
            ? "Add the cards shown on the public /scan wall. (Instagram & Discord are added automatically from your socials.)"
            : ""}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((t) => {
            const swatch = t.accent ? SCAN_ACCENT_SWATCH[t.accent] : null;
            return (
              <li
                key={t.id}
                draggable={canWrite}
                onDragStart={() => canWrite && setDragId(t.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                onDragOver={(e) => {
                  if (!canWrite || dragId == null) return;
                  e.preventDefault();
                  setOverId(t.id);
                }}
                onDrop={() => handleDrop(t.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border bg-surface px-3 py-2.5 transition-colors",
                  overId === t.id && dragId !== t.id ? "border-accent ring-1 ring-accent/40" : "border-border",
                  dragId === t.id && "opacity-40",
                  !t.isVisible && "opacity-70",
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

                <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-elevated text-muted">
                  <Icons.camera className="size-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{t.label}</span>
                    {!t.isVisible && <Badge variant="warning">Hidden</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {t.caption ? `${t.caption} · ` : ""}
                    {t.url}
                  </div>
                </div>

                <span
                  className="hidden size-4 shrink-0 rounded-full border border-border sm:block"
                  style={swatch ? { backgroundColor: swatch } : undefined}
                  title={t.accent ?? "Auto accent"}
                >
                  {!swatch && (
                    <span className="block size-full rounded-full bg-gradient-to-br from-pink-400 via-yellow-300 to-sky-400" />
                  )}
                </span>

                {canWrite && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleVisible(t)}
                      title={t.isVisible ? "Hide from public page" : "Show on public page"}
                      aria-label={t.isVisible ? "Hide card" : "Show card"}
                      className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-foreground"
                    >
                      {t.isVisible ? <Icons.eye className="size-4" /> : <Icons.eyeOff className="size-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModal(t)}
                      className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-foreground"
                      title="Edit card"
                      aria-label="Edit card"
                    >
                      <Icons.settings className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(t)}
                      className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-danger"
                      title="Delete card"
                      aria-label="Delete card"
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
        <p className="mt-3 text-xs text-muted">Drag the handle to reorder. Lower rows appear later on the wall.</p>
      )}

      <Modal
        open={modal !== null}
        onClose={closeModal}
        title={modal && modal !== "new" ? "Edit card" : "New card"}
      >
        {modal === "new" ? (
          <ScanForm action={createScanTarget} onSuccess={onModalSuccess} onCancel={closeModal} />
        ) : modal ? (
          <ScanForm
            action={updateScanTarget.bind(null, modal.id)}
            target={modal}
            onSuccess={onModalSuccess}
            onCancel={closeModal}
          />
        ) : null}
      </Modal>
    </>
  );
}
