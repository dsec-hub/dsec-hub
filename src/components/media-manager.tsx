"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";

import { deleteMedia, uploadMedia, type MediaState } from "@/app/(app)/media/actions";
import { Field, FormError, SelectField, TextInput } from "@/components/form";
import { Modal } from "@/components/modal";
import {
  Badge,
  Card,
  EmptyState,
  SectionCard,
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
} from "@/components/ui";
import { cn } from "@/lib/format";
import { cropToBlob, fileToWebpBlob, isHeic, toDisplayable } from "@/lib/image-crop";

export type EntityType =
  | "event"
  | "project"
  | "sponsor"
  | "speaker"
  | "person"
  | "partner"
  | "document";

export type MediaItem = {
  id: number;
  role: string;
  webpUrl: string;
  pngUrl: string;
  altText: string | null;
  width: number | null;
  height: number | null;
};

// `aspect: undefined` means free crop (logos keep their native proportions).
type RoleDef = { value: string; label: string; aspect: number | undefined; hint: string };

const GALLERY_ROLES: RoleDef[] = [
  { value: "banner", label: "Banner", aspect: 16 / 9, hint: "Wide hero — 16:9" },
  { value: "image", label: "Image", aspect: 1, hint: "Square — 1:1" },
  { value: "poster", label: "Poster", aspect: 4 / 5, hint: "Instagram poster — 4:5" },
];

// Which roles each entity supports. Single-role entities (sponsor logo, speaker
// photo) hide the role selector. Sponsor logos crop freely + keep transparency.
const ROLES_BY_ENTITY: Record<EntityType, RoleDef[]> = {
  event: GALLERY_ROLES,
  project: GALLERY_ROLES,
  sponsor: [
    { value: "logo", label: "Logo", aspect: undefined, hint: "Brand logo — transparent PNG works best; crop freely" },
  ],
  partner: [
    { value: "logo", label: "Logo", aspect: undefined, hint: "Brand logo — transparent PNG works best; crop freely" },
  ],
  speaker: [
    { value: "photo", label: "Photo", aspect: 1, hint: "Headshot — square 1:1" },
  ],
  person: [
    { value: "photo", label: "Photo", aspect: 1, hint: "Headshot — square 1:1" },
  ],
  // Custom-page images are normally added inline in the page editor; this entry
  // keeps the shared media unions exhaustive and offers the same banner/image/
  // logo roles if the MediaManager is ever pointed at a page.
  document: [
    { value: "banner", label: "Banner", aspect: 16 / 9, hint: "Wide hero — 16:9" },
    { value: "image", label: "Image", aspect: undefined, hint: "Any image — crop freely" },
    { value: "logo", label: "Logo", aspect: undefined, hint: "Logo — transparent PNG works best; crop freely" },
  ],
};

// Per-entity copy for the section header / empty state / buttons.
const SECTION_COPY: Record<EntityType, { title: string; add: string; empty: string }> = {
  event: { title: "Images", add: "Add image", empty: "No images yet. Upload a banner, poster, or image — they show on the public site." },
  project: { title: "Images", add: "Add image", empty: "No images yet. Upload a banner, poster, or image — they show on the public site." },
  sponsor: { title: "Logo", add: "Add logo", empty: "No logo yet. Upload the sponsor's brand logo — it shows on the public site." },
  partner: { title: "Logo", add: "Add logo", empty: "No logo yet. Upload the partner's brand logo — it shows on the events they collaborate on." },
  speaker: { title: "Photo", add: "Add photo", empty: "No photo yet. Upload a headshot — it shows on the public site." },
  person: { title: "Profile photo", add: "Add photo", empty: "No profile photo yet. Upload a headshot — it shows on the public team page (and as the lead avatar on events/projects they run)." },
  document: { title: "Images", add: "Add image", empty: "No images yet. Upload an image — add it to a block in the page editor." },
};

function roleVariant(role: string) {
  return role === "banner" || role === "logo"
    ? "accent"
    : role === "poster"
      ? "success"
      : "neutral";
}

/** Tiny dependency-free spinner that inherits the button's text colour. */
function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

/** Swaps an idle ↔ busy label inside one shared grid cell. Both labels stay
 *  mounted and only one is shown at a time (the other is hidden, not unmounted),
 *  so the button never flickers from a node swap and Safari never ghosts from an
 *  in-place text change. The swap is instant — no opacity transition — so the two
 *  labels never overlap mid-fade. The shared cell auto-sizes to the wider label,
 *  so the button width never jumps either. */
function PendingLabel({
  pending,
  idle,
  busy,
}: {
  pending: boolean;
  idle: React.ReactNode;
  busy: React.ReactNode;
}) {
  return (
    <span className="grid place-items-center">
      <span
        aria-hidden={pending}
        className={cn(
          "col-start-1 row-start-1 flex items-center gap-1.5",
          pending && "invisible",
        )}
      >
        {idle}
      </span>
      <span
        aria-hidden={!pending}
        className={cn(
          "col-start-1 row-start-1 flex items-center gap-1.5",
          !pending && "invisible",
        )}
      >
        {busy}
      </span>
    </span>
  );
}

export type UploadAction = (prev: MediaState, fd: FormData) => Promise<MediaState>;
export type DeleteAction = (
  id: number,
  entityType: EntityType,
  entityId: number,
) => Promise<MediaState>;

export function MediaManager({
  entityType,
  entityId,
  existing,
  canWrite = true,
  emptyOverride,
  uploadAction = uploadMedia,
  deleteAction = deleteMedia,
}: {
  entityType: EntityType;
  entityId: number;
  existing: MediaItem[];
  canWrite?: boolean;
  // Replaces the default "No … yet" empty-state copy — used when a linked
  // speaker is showing an inherited profile photo, so uploading here reads as
  // an *override* rather than implying nothing is set.
  emptyOverride?: React.ReactNode;
  // Override the upload/delete server actions. Defaults to the admin (people /
  // events / … write-gated) actions; the self-service profile page injects
  // owner-scoped variants so a view-only member can manage their OWN headshot.
  uploadAction?: UploadAction;
  deleteAction?: DeleteAction;
}) {
  const [open, setOpen] = useState(false);
  const copy = SECTION_COPY[entityType];

  return (
    <SectionCard
      title={copy.title}
      action={
        canWrite ? (
          <button type="button" className={buttonPrimary} onClick={() => setOpen(true)}>
            {copy.add}
          </button>
        ) : undefined
      }
    >
      {existing.length === 0 ? (
        <EmptyState>
          {emptyOverride ?? (canWrite ? copy.empty : `No ${copy.title.toLowerCase()} yet.`)}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-4 px-5 pt-5 pb-4 sm:grid-cols-3">
          {existing.map((m) => (
            <MediaCard
              key={m.id}
              item={m}
              entityType={entityType}
              entityId={entityId}
              canWrite={canWrite}
              deleteAction={deleteAction}
            />
          ))}
        </div>
      )}

      {canWrite && (
        <Modal open={open} onClose={() => setOpen(false)} title={`Upload ${copy.title.toLowerCase()}`}>
          <Uploader
            entityType={entityType}
            entityId={entityId}
            onDone={() => setOpen(false)}
            uploadAction={uploadAction}
          />
        </Modal>
      )}
    </SectionCard>
  );
}

function MediaCard({
  item,
  entityType,
  entityId,
  canWrite,
  deleteAction,
}: {
  item: MediaItem;
  entityType: EntityType;
  entityId: number;
  canWrite: boolean;
  deleteAction: DeleteAction;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();

  const onDelete = () => {
    if (!confirm("Remove this image? This cannot be undone.")) return;
    setError(undefined);
    start(async () => {
      const res = await deleteAction(item.id, entityType, entityId);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Image removed.");
      }
    });
  };

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video bg-elevated">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.webpUrl}
          alt={item.altText ?? ""}
          className="h-full w-full object-cover"
        />
        <span className="absolute left-2 top-2">
          <Badge variant={roleVariant(item.role)}>{item.role}</Badge>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <a
          href={`${item.pngUrl}?download`}
          className="text-xs text-muted transition-colors hover:text-foreground"
        >
          Download PNG
        </a>
        {canWrite && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            // `!` forces the small size over buttonDanger's px-3/py-1.5 (cn can't merge)
            className={cn(buttonDanger, "px-2! py-1! text-xs")}
            aria-busy={pending}
          >
            {/* Busy state is just the spinner so the button stays as narrow as
                "Delete" (PendingLabel sizes to the wider label). */}
            <PendingLabel
              pending={pending}
              idle="Delete"
              busy={<Spinner className="size-3" />}
            />
          </button>
        )}
      </div>
      {error && <p className="px-3 pb-2 text-xs text-danger">{error}</p>}
    </Card>
  );
}

function Uploader({
  entityType,
  entityId,
  onDone,
  uploadAction,
}: {
  entityType: EntityType;
  entityId: number;
  onDone: () => void;
  uploadAction: UploadAction;
}) {
  const roles = ROLES_BY_ENTITY[entityType];
  const singleRole = roles.length === 1;
  const [role, setRole] = useState<RoleDef>(roles[0]);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [alt, setAlt] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  // Logos match the crop frame to the image's own aspect (set on media load).
  const [logoAspect, setLogoAspect] = useState<number | undefined>(undefined);
  const [state, setState] = useState<MediaState>();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [statuses, setStatuses] = useState<("ok" | "err")[]>([]);
  const [converting, setConverting] = useState(false);
  const [pending, start] = useTransition();

  const bulk = files.length > 1;
  const isLogo = role.value === "logo";

  // Revoke object URLs whenever the selection changes / on unmount.
  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews]);

  const warn = (msg: string) => {
    setState({ error: msg });
    toast.error(msg);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    setState(undefined);
    setProgress(null);
    setStatuses([]);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    setLogoAspect(undefined);
    setFiles([]);
    setPreviews([]);

    if (!picked.some(isHeic)) {
      setFiles(picked);
      setPreviews(picked.map((f) => URL.createObjectURL(f)));
      return;
    }
    // At least one Apple photo — decode HEIC → JPEG before previewing/cropping.
    setConverting(true);
    void toDisplayable(picked)
      .then((ready) => {
        setFiles(ready);
        setPreviews(ready.map((f) => URL.createObjectURL(f)));
      })
      .catch((err: unknown) =>
        warn(`Couldn't read that HEIC photo — ${(err as Error).message}`),
      )
      .finally(() => setConverting(false));
  };

  const onCropComplete = useCallback((_a: Area, pixels: Area) => setArea(pixels), []);

  const uploadOne = (blob: Blob, name: string, altText?: string) => {
    const fd = new FormData();
    fd.set("entity_type", entityType);
    fd.set("entity_id", String(entityId));
    fd.set("role", role.value);
    if (altText?.trim()) fd.set("alt_text", altText.trim());
    fd.set("file", blob, name);
    return uploadAction(undefined, fd);
  };

  const onUpload = () => {
    if (!files.length) return warn("Pick at least one image first.");
    if (!bulk && !area) return warn("Frame the crop first.");
    start(async () => {
      try {
        if (!bulk) {
          // Single image — interactive crop.
          if (!area) return;
          const blob = await cropToBlob(previews[0], area);
          const res = await uploadOne(blob, `${role.value}.webp`, alt);
          if (res?.error) {
            setState(res);
            toast.error(res.error);
            return;
          }
          toast.success("Image uploaded.");
          onDone();
          return;
        }
        // Bulk — downscale + compress each, upload sequentially with progress.
        let ok = 0;
        const failed: string[] = [];
        const next: ("ok" | "err")[] = [];
        setProgress({ done: 0, total: files.length });
        for (let i = 0; i < files.length; i++) {
          try {
            const blob = await fileToWebpBlob(files[i]);
            const res = await uploadOne(blob, `${role.value}-${i + 1}.webp`);
            if (res?.error) {
              failed.push(`${files[i].name}: ${res.error}`);
              next.push("err");
            } else {
              ok += 1;
              next.push("ok");
            }
          } catch (err) {
            failed.push(`${files[i].name}: ${(err as Error).message}`);
            next.push("err");
          }
          setStatuses([...next]);
          setProgress({ done: i + 1, total: files.length });
        }
        if (failed.length) {
          setState({
            error: `Uploaded ${ok}/${files.length}. Failed — ${failed.join("; ")}`.slice(
              0,
              300,
            ),
          });
          toast.error(`${failed.length} of ${files.length} image(s) failed.`);
        } else {
          toast.success(`Uploaded ${ok} image${ok === 1 ? "" : "s"}.`);
          onDone();
        }
      } catch (e) {
        const msg = (e as Error).message;
        setState({ error: msg });
        toast.error(msg);
      }
    });
  };

  const ready = files.length > 0 && (bulk || area !== null);
  const idleLabel = bulk ? `Upload ${files.length} images` : "Upload";
  const busyLabel =
    bulk && progress ? `Uploading ${progress.done}/${progress.total}…` : "Uploading…";

  return (
    <div className="flex flex-col gap-4">
      <FormError>{state?.error}</FormError>

      {!singleRole && (
        <Field label="Type" hint={bulk ? "Tag applied to every image in this batch." : role.hint}>
          <SelectField
            value={role.value}
            onChange={(e) =>
              setRole(roles.find((r) => r.value === e.target.value) ?? roles[0])
            }
          >
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </SelectField>
        </Field>
      )}

      <Field
        label="Image file"
        hint="JPEG, PNG, WebP, or HEIC. Pick several to upload in bulk — each is resized & compressed automatically."
      >
        <input
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          onChange={onPick}
          className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-foreground hover:file:opacity-90"
        />
      </Field>

      {converting && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Spinner className="size-3" />
          Converting HEIC photo…
        </p>
      )}

      {/* Single image → interactive crop. */}
      {!bulk && previews[0] && (
        <>
          <div className="relative h-72 w-full overflow-hidden rounded-md bg-elevated">
            <Cropper
              image={previews[0]}
              crop={crop}
              zoom={zoom}
              // Logos: match the frame to the image's own aspect so it isn't
              // forced into react-easy-crop's default 4:3, and allow zoom < 1
              // (restrictPosition off) to pad the mark out to any size.
              aspect={isLogo ? logoAspect : role.aspect}
              minZoom={isLogo ? 0.3 : 1}
              restrictPosition={!isLogo}
              onMediaLoaded={
                isLogo
                  ? (m) => setLogoAspect(m.naturalWidth / m.naturalHeight)
                  : undefined
              }
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <label className="flex items-center gap-3 text-xs text-muted">
            <span className="shrink-0">Zoom</span>
            <input
              type="range"
              min={isLogo ? 0.3 : 1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-[var(--color-accent)]"
            />
          </label>
          {isLogo && (
            <p className="-mt-1 text-xs text-muted">
              Zoom out below 1× to frame the whole logo with transparent padding —
              any size or aspect.
            </p>
          )}
          <Field label="Alt text" hint="Describes the image for accessibility (optional).">
            <TextInput
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="e.g. Crowd at the 2026 hackathon finale"
            />
          </Field>
        </>
      )}

      {/* Multiple images → thumbnail grid, processed without per-image cropping. */}
      {bulk && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">
            {files.length} images selected — resized &amp; compressed on upload (no
            cropping in bulk).
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {previews.map((u, i) => (
              <div
                key={u}
                className="relative aspect-square overflow-hidden rounded-md border border-border bg-elevated"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="h-full w-full object-cover" />
                {statuses[i] && (
                  <span
                    className={cn(
                      "absolute inset-0 grid place-items-center text-lg font-semibold text-white",
                      statuses[i] === "ok" ? "bg-success/70" : "bg-danger/70",
                    )}
                  >
                    {statuses[i] === "ok" ? "✓" : "✗"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" className={buttonSecondary} onClick={onDone}>
          Cancel
        </button>
        <button
          type="button"
          className={buttonPrimary}
          onClick={onUpload}
          disabled={pending || !ready}
          aria-busy={pending}
        >
          <PendingLabel
            pending={pending}
            idle={idleLabel}
            busy={
              <>
                <Spinner />
                {busyLabel}
              </>
            }
          />
        </button>
      </div>
    </div>
  );
}
