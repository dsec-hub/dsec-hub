"use client";

import { useCallback, useTransition } from "react";
import { useState } from "react";

import { Modal } from "@/components/modal";
import { buttonDanger, buttonPrimary, buttonSecondary } from "@/components/ui";
import type { SponsorPackageRow } from "@/lib/queries";

import { createPackage, deletePackage, updatePackage } from "./actions";
import { PackageForm } from "./package-form";

type Mode = "new" | "edit";

export function PackageManager({
  packages: _packages,
  mode,
  pkg,
  canWrite,
}: {
  packages: SponsorPackageRow[];
  mode: Mode;
  pkg?: SponsorPackageRow;
  canWrite: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = useCallback(() => {
    if (!pkg) return;
    startTransition(async () => {
      await deletePackage(pkg.id);
      setConfirmDelete(false);
    });
  }, [pkg]);

  if (mode === "new") {
    if (!canWrite) return null;
    return (
      <>
        <button type="button" className={buttonPrimary} onClick={() => setOpen(true)}>
          New package
        </button>
        <Modal open={open} onClose={() => setOpen(false)} title="New sponsorship package">
          <PackageForm action={createPackage} onSuccess={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </Modal>
      </>
    );
  }

  if (!pkg) return null;
  if (!canWrite) return null;

  const editAction = updatePackage.bind(null, pkg.id);

  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={buttonSecondary} onClick={() => setOpen(true)}>
        Edit
      </button>
      <button
        type="button"
        className={buttonDanger}
        onClick={() => setConfirmDelete(true)}
        disabled={isPending}
      >
        Delete
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Edit "${pkg.name}"`}>
        <PackageForm
          action={editAction}
          pkg={pkg}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete package?">
        <p className="text-sm text-muted">
          This will permanently remove <strong>{pkg.name}</strong> from the database. The public
          website will stop showing it immediately.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className={buttonSecondary}
            onClick={() => setConfirmDelete(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className={buttonDanger}
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
