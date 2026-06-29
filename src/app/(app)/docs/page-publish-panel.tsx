"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Field, SelectField, TextArea, TextInput } from "@/components/form";
import { Icons } from "@/components/icons";
import { PublishToggle } from "@/components/publish-toggle";
import { Badge, SectionCard, buttonGhost, buttonSecondary } from "@/components/ui";
import { cn } from "@/lib/format";
import { fileToWebpBlob, heicToJpeg, isHeic } from "@/lib/image-crop";
import type { Block } from "@/lib/page-blocks";
import type { ActionResult } from "@/lib/undo-types";

import type { UploadPageImage } from "./page-blocks-editor";
import { PageBlocksEditor } from "./page-blocks-editor";

export type PagePublishPanelProps = {
  docId: number;
  canWrite: boolean;
  published: boolean;
  slug: string | null;
  navLabel: string | null;
  showInNav: boolean;
  navArea: string | null;
  navOrder: number;
  seoDescription: string | null;
  coverImageUrl: string | null;
  blocks: Block[];
  publishAction: (published: boolean) => Promise<ActionResult>;
  uploadAction: UploadPageImage;
  previewUrl: string | null;
  siteUrl: string | null;
  websiteOrigin: string | null;
};

/**
 * The "Publish as page" panel rendered (for Page-type docs) inside the document
 * form on the edit screen. Its inputs ride the same <form> as the rest of the
 * doc, so Save persists slug / nav / SEO / cover / blocks in one shot. The
 * Publish toggle is a separate action (setDocumentPublished) so saving content
 * never flips a page live by accident.
 */
export function PagePublishPanel({
  docId,
  canWrite,
  published,
  slug,
  navLabel,
  showInNav,
  navArea,
  navOrder,
  seoDescription,
  coverImageUrl,
  blocks,
  publishAction,
  uploadAction,
  previewUrl,
  siteUrl,
  websiteOrigin,
}: PagePublishPanelProps) {
  const prefix = (websiteOrigin ?? "dsec.club").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const blockedReason = canWrite ? undefined : "View only";

  return (
    <SectionCard
      title="Publish as page"
      action={
        <div className="flex items-center gap-2">
          <Badge variant={published ? "success" : "warning"}>{published ? "Published" : "Draft"}</Badge>
          {canWrite && <PublishToggle published={published} action={publishAction} blockedReason={blockedReason} />}
        </div>
      }
    >
      <div className="space-y-6 p-5">
        {(previewUrl || siteUrl) && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {published && siteUrl && (
              <a href={siteUrl} target="_blank" rel="noopener noreferrer" className={buttonSecondary}>
                View page <Icons.arrowRight className="size-4" />
              </a>
            )}
            {!published && previewUrl && (
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className={buttonSecondary}>
                Preview page <Icons.arrowRight className="size-4" />
              </a>
            )}
          </div>
        )}

        <fieldset disabled={!canWrite} className="space-y-5">
          <Field label="Slug" hint="The page lives at this clean URL. Generated from the title on publish if left blank.">
            <div className="flex items-stretch overflow-hidden rounded-md border border-border bg-surface focus-within:border-accent">
              <span className="flex select-none items-center whitespace-nowrap border-r border-border bg-elevated px-3 text-sm text-muted">
                {prefix}/
              </span>
              <input
                name="slug"
                defaultValue={slug ?? ""}
                placeholder="my-page"
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
              />
            </div>
          </Field>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nav label" hint="Shown in the site nav (falls back to the title).">
              <TextInput name="nav_label" defaultValue={navLabel ?? ""} placeholder="Page" />
            </Field>
            <Field label="Nav area">
              <SelectField name="nav_area" defaultValue={navArea ?? "header"}>
                <option value="header">Header</option>
                <option value="footer">Footer</option>
              </SelectField>
            </Field>
            <Field label="Nav order" hint="Lower shows first.">
              <TextInput name="nav_order" type="number" inputMode="numeric" defaultValue={String(navOrder ?? 0)} />
            </Field>
          </div>

          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="show_in_nav"
              defaultChecked={showInNav}
              className="size-4 rounded border-border bg-background accent-[var(--color-accent)]"
            />
            <span>Show this page in the website navigation</span>
          </label>

          <Field label="SEO description" hint="Used for search results & link previews.">
            <TextArea name="seo_description" defaultValue={seoDescription ?? ""} className="min-h-16" placeholder="A short summary of this page." />
          </Field>

          <CoverImageField docId={docId} canWrite={canWrite} initial={coverImageUrl} uploadAction={uploadAction} />
        </fieldset>

        <div>
          <div className="mb-2 text-sm font-medium">Page content</div>
          <PageBlocksEditor docId={docId} initial={blocks} canWrite={canWrite} uploadAction={uploadAction} />
        </div>
      </div>
    </SectionCard>
  );
}

/** Cover image slot — stores the chosen WebP URL in a hidden `cover_image_url`
 * field so the form save persists it. */
function CoverImageField({
  docId,
  canWrite,
  initial,
  uploadAction,
}: {
  docId: number;
  canWrite: boolean;
  initial: string | null;
  uploadAction: UploadPageImage;
}) {
  const [url, setUrl] = useState<string>(initial ?? "");
  const [pending, start] = useTransition();

  const upload = (file: File) => {
    start(async () => {
      try {
        const ready = isHeic(file) ? await heicToJpeg(file) : file;
        const blob = await fileToWebpBlob(ready);
        const fd = new FormData();
        fd.set("role", "banner");
        fd.set("file", blob, "cover.webp");
        const res = await uploadAction(docId, fd);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        setUrl(res.image.webp);
        toast.success("Cover image uploaded.");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  return (
    <Field label="Cover image" hint="Used as the social/share image and an optional page header.">
      <input type="hidden" name="cover_image_url" value={url} />
      {url ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-20 w-32 shrink-0 rounded-md border border-border object-cover" />
          {canWrite && (
            <button
              type="button"
              onClick={() => setUrl("")}
              className={cn(buttonGhost, "px-1.5 hover:text-danger")}
              aria-label="Remove cover image"
            >
              <Icons.close className="size-4" /> Remove
            </button>
          )}
        </div>
      ) : (
        canWrite && (
          <label className={cn(buttonSecondary, "w-fit cursor-pointer text-xs", pending && "opacity-60")}>
            <Icons.camera className="size-4" />
            {pending ? "Uploading…" : "Upload cover image"}
            <input
              type="file"
              accept="image/*,.heic,.heif"
              className="sr-only"
              disabled={pending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
          </label>
        )
      )}
    </Field>
  );
}
