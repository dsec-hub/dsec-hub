"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Field, SelectField, TextArea, TextInput } from "@/components/form";
import { Icons } from "@/components/icons";
import { buttonGhost, buttonSecondary } from "@/components/ui";
import { cn } from "@/lib/format";
import { fileToWebpBlob, heicToJpeg, isHeic } from "@/lib/image-crop";
import {
  ACCENTS,
  BLOCK_KINDS,
  BLOCK_LABEL,
  newBlock,
  toPageDoc,
  type Accent,
  type Block,
  type BlockGroup,
  type BlockType,
  type ButtonVariant,
  type CardItem,
  type FaqItem,
  type ImageRef,
  type LogoItem,
  type PageButton,
  type StatItem,
} from "@/lib/page-blocks";

import type { PageImageResult } from "./actions";

export type UploadPageImage = (docId: number, fd: FormData) => Promise<PageImageResult>;

const BUTTON_VARIANTS: ButtonVariant[] = ["pink", "ghost", "blue", "mint", "void"];

/** The four palette families, in display order (matches BLOCK_KINDS.group). */
const GROUPS: BlockGroup[] = ["Heroes & text", "Images & media", "Layout", "Marketing"];

type Patch = Record<string, unknown>;

/**
 * The page body editor: a repeatable list of typed content blocks, modelled on
 * the meeting agenda editor. The whole block list rides to the server as one
 * hidden `content_json` field (JSON.stringify(toPageDoc(blocks))) so the parent
 * <form>'s save action persists it in one shot. Images upload immediately (they
 * need the doc id) and write their URL straight into the block.
 */
export function PageBlocksEditor({
  docId,
  initial,
  canWrite,
  uploadAction,
}: {
  docId: number;
  initial: Block[];
  canWrite: boolean;
  uploadAction: UploadPageImage;
}) {
  const [blocks, setBlocks] = useState<Block[]>(initial);

  const update = (id: string, patch: Patch) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  const add = (type: BlockType) => setBlocks((prev) => [...prev, newBlock(type)]);
  const remove = (id: string) => setBlocks((prev) => prev.filter((b) => b.id !== id));
  const move = (index: number, dir: -1 | 1) =>
    setBlocks((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  return (
    <div className="space-y-4">
      {/* The block list travels as one JSON field (like the agenda editor). */}
      <input type="hidden" name="content_json" value={JSON.stringify(toPageDoc(blocks))} />

      {blocks.length === 0 && (
        <p className="rounded-xl border border-dashed border-border bg-surface px-5 py-8 text-center text-sm text-muted">
          No blocks yet. {canWrite ? "Add one from the palette below." : ""}
        </p>
      )}

      <ol className="space-y-3">
        {blocks.map((b, i) => (
          <li key={b.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-elevated text-xs text-muted tabular-nums">
                  {i + 1}
                </span>
                {BLOCK_LABEL[b.type]}
              </span>
              {canWrite && (
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className={cn(buttonGhost, "px-1.5 disabled:opacity-30")}
                  >
                    <Icons.chevron className="size-4 rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === blocks.length - 1}
                    aria-label="Move down"
                    className={cn(buttonGhost, "px-1.5 disabled:opacity-30")}
                  >
                    <Icons.chevron className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(b.id)}
                    aria-label="Remove block"
                    className={cn(buttonGhost, "px-1.5 hover:text-danger")}
                  >
                    <Icons.trash className="size-4" />
                  </button>
                </div>
              )}
            </div>

            <fieldset disabled={!canWrite} className="space-y-3">
              <BlockBody
                block={b}
                docId={docId}
                canWrite={canWrite}
                uploadAction={uploadAction}
                update={update}
              />
            </fieldset>
          </li>
        ))}
      </ol>

      {canWrite && (
        <div className="rounded-xl border border-dashed border-border bg-surface p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted/70">
            Add a block
          </div>
          <div className="space-y-3">
            {GROUPS.map((group) => (
              <div key={group}>
                <div className="mb-1.5 text-xs text-muted">{group}</div>
                <div className="flex flex-wrap gap-2">
                  {BLOCK_KINDS.filter((k) => k.group === group).map((k) => (
                    <button
                      key={k.type}
                      type="button"
                      onClick={() => add(k.type)}
                      title={k.hint}
                      className={cn(buttonSecondary, "text-xs")}
                    >
                      + {k.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-type field editors
// ---------------------------------------------------------------------------

type BodyProps = {
  block: Block;
  docId: number;
  canWrite: boolean;
  uploadAction: UploadPageImage;
  update: (id: string, patch: Patch) => void;
};

function BlockBody({ block, docId, canWrite, uploadAction, update }: BodyProps) {
  const set = (patch: Patch) => update(block.id, patch);
  const img = (role: string, value: ImageRef | undefined, onChange: (v: ImageRef | undefined) => void) => (
    <ImagePicker
      docId={docId}
      role={role}
      value={value}
      canWrite={canWrite}
      uploadAction={uploadAction}
      onChange={onChange}
    />
  );

  switch (block.type) {
    case "hero":
      return (
        <>
          <TwoCol>
            <Field label="Eyebrow">
              <TextInput value={block.eyebrow ?? ""} onChange={(e) => set({ eyebrow: e.target.value })} />
            </Field>
            <AlignField value={block.align} onChange={(v) => set({ align: v })} />
          </TwoCol>
          <Field label="Title">
            <TextInput value={block.title ?? ""} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Subtitle">
            <TextInput value={block.subtitle ?? ""} onChange={(e) => set({ subtitle: e.target.value })} />
          </Field>
          <TwoCol>
            <Field label="Variant">
              <SelectField
                value={block.variant ?? "banner"}
                onChange={(e) => set({ variant: e.target.value })}
              >
                <option value="banner">Banner (with image)</option>
                <option value="plain">Plain</option>
              </SelectField>
            </Field>
            <Field label="Background image">{img("banner", block.image, (v) => set({ image: v }))}</Field>
          </TwoCol>
          <ButtonsEditor
            value={block.buttons ?? []}
            canWrite={canWrite}
            onChange={(buttons) => set({ buttons })}
          />
        </>
      );

    case "heading":
      return (
        <>
          <TwoCol>
            <Field label="Eyebrow">
              <TextInput value={block.eyebrow ?? ""} onChange={(e) => set({ eyebrow: e.target.value })} />
            </Field>
            <AlignField value={block.align} onChange={(v) => set({ align: v })} />
          </TwoCol>
          <Field label="Title">
            <TextInput value={block.title ?? ""} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Subtitle">
            <TextInput value={block.subtitle ?? ""} onChange={(e) => set({ subtitle: e.target.value })} />
          </Field>
        </>
      );

    case "richtext":
      return (
        <Field label="Markdown" hint="Markdown supported.">
          <TextArea
            value={block.markdown ?? ""}
            onChange={(e) => set({ markdown: e.target.value })}
            className="min-h-28"
            placeholder="Write in Markdown… # headings, - lists, **bold**, [links](…)"
          />
        </Field>
      );

    case "quote":
      return (
        <>
          <Field label="Quote">
            <TextArea value={block.text ?? ""} onChange={(e) => set({ text: e.target.value })} />
          </Field>
          <Field label="Attribution">
            <TextInput
              value={block.attribution ?? ""}
              onChange={(e) => set({ attribution: e.target.value })}
              placeholder="— Name, role"
            />
          </Field>
        </>
      );

    case "image":
      return (
        <>
          <Field label="Image">{img("image", block.image, (v) => set({ image: v }))}</Field>
          <TwoCol>
            <Field label="Caption">
              <TextInput value={block.caption ?? ""} onChange={(e) => set({ caption: e.target.value })} />
            </Field>
            <Field label="Width">
              <SelectField value={block.width ?? "wide"} onChange={(e) => set({ width: e.target.value })}>
                <option value="full">Full bleed</option>
                <option value="wide">Wide</option>
                <option value="inset">Inset</option>
              </SelectField>
            </Field>
          </TwoCol>
        </>
      );

    case "gallery": {
      const images = block.images ?? [];
      const setImages = (next: ImageRef[]) => set({ images: next });
      return (
        <>
          <Field label="Columns">
            <ColumnsSelect value={block.columns ?? 3} onChange={(n) => set({ columns: n })} />
          </Field>
          <div className="space-y-2">
            <div className="text-sm text-muted">Images</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {images.map((image, idx) => (
                <div key={idx} className="rounded-lg border border-border p-2">
                  <ImagePicker
                    docId={docId}
                    role="image"
                    value={image}
                    canWrite={canWrite}
                    uploadAction={uploadAction}
                    onChange={(v) =>
                      setImages(v ? images.map((x, i) => (i === idx ? v : x)) : images.filter((_, i) => i !== idx))
                    }
                  />
                </div>
              ))}
            </div>
            {canWrite && (
              <ImageAdder
                docId={docId}
                role="image"
                uploadAction={uploadAction}
                onAdd={(v) => setImages([...images, v])}
                label="Add image to gallery"
              />
            )}
          </div>
        </>
      );
    }

    case "embed":
      return (
        <>
          <TwoCol>
            <Field label="Provider">
              <SelectField
                value={block.provider ?? "youtube"}
                onChange={(e) => set({ provider: e.target.value })}
              >
                <option value="youtube">YouTube</option>
                <option value="vimeo">Vimeo</option>
                <option value="iframe">Iframe</option>
              </SelectField>
            </Field>
            <Field label="Aspect ratio">
              <SelectField value={block.ratio ?? "16:9"} onChange={(e) => set({ ratio: e.target.value })}>
                <option value="16:9">16:9</option>
                <option value="4:3">4:3</option>
                <option value="1:1">1:1</option>
              </SelectField>
            </Field>
          </TwoCol>
          <Field label="URL">
            <TextInput
              value={block.url ?? ""}
              onChange={(e) => set({ url: e.target.value })}
              placeholder="https://youtube.com/watch?v=…"
            />
          </Field>
          <Field label="Caption">
            <TextInput value={block.caption ?? ""} onChange={(e) => set({ caption: e.target.value })} />
          </Field>
        </>
      );

    case "split":
      return (
        <>
          <Field label="Image">{img("image", block.image, (v) => set({ image: v }))}</Field>
          <TwoCol>
            <Field label="Image side">
              <SelectField
                value={block.imageSide ?? "right"}
                onChange={(e) => set({ imageSide: e.target.value })}
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
              </SelectField>
            </Field>
            <Field label="Eyebrow">
              <TextInput value={block.eyebrow ?? ""} onChange={(e) => set({ eyebrow: e.target.value })} />
            </Field>
          </TwoCol>
          <Field label="Title">
            <TextInput value={block.title ?? ""} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Body" hint="Markdown supported.">
            <TextArea value={block.markdown ?? ""} onChange={(e) => set({ markdown: e.target.value })} />
          </Field>
          <ButtonsEditor
            value={block.buttons ?? []}
            canWrite={canWrite}
            onChange={(buttons) => set({ buttons })}
          />
        </>
      );

    case "columns": {
      const cols = block.columns ?? [];
      const setCols = (next: { markdown?: string }[]) => set({ columns: next });
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted">Columns (2–4)</div>
          {cols.map((c, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <TextArea
                value={c.markdown ?? ""}
                onChange={(e) => setCols(cols.map((x, i) => (i === idx ? { markdown: e.target.value } : x)))}
                className="min-h-16 flex-1"
                placeholder={`Column ${idx + 1} — Markdown`}
              />
              {canWrite && cols.length > 1 && (
                <button
                  type="button"
                  onClick={() => setCols(cols.filter((_, i) => i !== idx))}
                  aria-label="Remove column"
                  className={cn(buttonGhost, "mt-1 px-1.5 hover:text-danger")}
                >
                  <Icons.close className="size-4" />
                </button>
              )}
            </div>
          ))}
          {canWrite && cols.length < 4 && (
            <button
              type="button"
              onClick={() => setCols([...cols, { markdown: "" }])}
              className={cn(buttonSecondary, "text-xs")}
            >
              + Add column
            </button>
          )}
        </div>
      );
    }

    case "cards": {
      const cards = block.cards ?? [];
      const setCards = (next: CardItem[]) => set({ cards: next });
      const patchCard = (idx: number, patch: Partial<CardItem>) =>
        setCards(cards.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
      return (
        <>
          <TwoCol>
            <Field label="Eyebrow">
              <TextInput value={block.eyebrow ?? ""} onChange={(e) => set({ eyebrow: e.target.value })} />
            </Field>
            <Field label="Columns">
              <ColumnsSelect value={block.columns ?? 3} onChange={(n) => set({ columns: n })} />
            </Field>
          </TwoCol>
          <Field label="Title">
            <TextInput value={block.title ?? ""} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <div className="space-y-2">
            <div className="text-sm text-muted">Cards</div>
            {cards.map((c, idx) => (
              <ItemCard
                key={idx}
                onRemove={canWrite ? () => setCards(cards.filter((_, i) => i !== idx)) : undefined}
              >
                <TwoCol>
                  <Field label="Title">
                    <TextInput value={c.title ?? ""} onChange={(e) => patchCard(idx, { title: e.target.value })} />
                  </Field>
                  <AccentField value={c.accent} onChange={(v) => patchCard(idx, { accent: v })} />
                </TwoCol>
                <Field label="Body">
                  <TextArea value={c.body ?? ""} onChange={(e) => patchCard(idx, { body: e.target.value })} className="min-h-14" />
                </Field>
                <Field label="Link (optional)">
                  <TextInput value={c.href ?? ""} onChange={(e) => patchCard(idx, { href: e.target.value })} placeholder="/events or https://…" />
                </Field>
                <Field label="Image (optional)">
                  <ImagePicker
                    docId={docId}
                    role="image"
                    value={c.image}
                    canWrite={canWrite}
                    uploadAction={uploadAction}
                    onChange={(v) => patchCard(idx, { image: v })}
                  />
                </Field>
              </ItemCard>
            ))}
            {canWrite && (
              <button
                type="button"
                onClick={() => setCards([...cards, {}])}
                className={cn(buttonSecondary, "text-xs")}
              >
                + Add card
              </button>
            )}
          </div>
        </>
      );
    }

    case "divider":
      return (
        <Field label="Style">
          <SelectField value={block.variant ?? "line"} onChange={(e) => set({ variant: e.target.value })}>
            <option value="line">Line</option>
            <option value="space">Space</option>
          </SelectField>
        </Field>
      );

    case "cta":
      return (
        <>
          <TwoCol>
            <Field label="Eyebrow">
              <TextInput value={block.eyebrow ?? ""} onChange={(e) => set({ eyebrow: e.target.value })} />
            </Field>
            <AlignField value={block.align} onChange={(v) => set({ align: v })} />
          </TwoCol>
          <Field label="Title">
            <TextInput value={block.title ?? ""} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Body">
            <TextArea value={block.body ?? ""} onChange={(e) => set({ body: e.target.value })} className="min-h-14" />
          </Field>
          <ButtonsEditor
            value={block.buttons ?? []}
            canWrite={canWrite}
            onChange={(buttons) => set({ buttons })}
          />
        </>
      );

    case "stats": {
      const items = block.items ?? [];
      const setItems = (next: StatItem[]) => set({ items: next });
      const patchItem = (idx: number, patch: Partial<StatItem>) =>
        setItems(items.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
      return (
        <>
          <TwoCol>
            <Field label="Eyebrow">
              <TextInput value={block.eyebrow ?? ""} onChange={(e) => set({ eyebrow: e.target.value })} />
            </Field>
            <Field label="Title">
              <TextInput value={block.title ?? ""} onChange={(e) => set({ title: e.target.value })} />
            </Field>
          </TwoCol>
          <div className="space-y-2">
            <div className="text-sm text-muted">Stats</div>
            {items.map((s, idx) => (
              <ItemRow
                key={idx}
                onRemove={canWrite ? () => setItems(items.filter((_, i) => i !== idx)) : undefined}
              >
                <TextInput
                  value={s.value ?? ""}
                  onChange={(e) => patchItem(idx, { value: e.target.value })}
                  placeholder="500+"
                  className="sm:w-32"
                />
                <TextInput
                  value={s.label ?? ""}
                  onChange={(e) => patchItem(idx, { label: e.target.value })}
                  placeholder="members"
                  className="flex-1"
                />
                <AccentSelect value={s.accent} onChange={(v) => patchItem(idx, { accent: v })} />
              </ItemRow>
            ))}
            {canWrite && (
              <button
                type="button"
                onClick={() => setItems([...items, {}])}
                className={cn(buttonSecondary, "text-xs")}
              >
                + Add stat
              </button>
            )}
          </div>
        </>
      );
    }

    case "faq": {
      const items = block.items ?? [];
      const setItems = (next: FaqItem[]) => set({ items: next });
      const patchItem = (idx: number, patch: Partial<FaqItem>) =>
        setItems(items.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
      return (
        <>
          <TwoCol>
            <Field label="Eyebrow">
              <TextInput value={block.eyebrow ?? ""} onChange={(e) => set({ eyebrow: e.target.value })} />
            </Field>
            <Field label="Title">
              <TextInput value={block.title ?? ""} onChange={(e) => set({ title: e.target.value })} />
            </Field>
          </TwoCol>
          <div className="space-y-2">
            <div className="text-sm text-muted">Questions</div>
            {items.map((q, idx) => (
              <ItemCard
                key={idx}
                onRemove={canWrite ? () => setItems(items.filter((_, i) => i !== idx)) : undefined}
              >
                <Field label="Question">
                  <TextInput value={q.q ?? ""} onChange={(e) => patchItem(idx, { q: e.target.value })} />
                </Field>
                <Field label="Answer" hint="Markdown supported.">
                  <TextArea value={q.a ?? ""} onChange={(e) => patchItem(idx, { a: e.target.value })} className="min-h-14" />
                </Field>
              </ItemCard>
            ))}
            {canWrite && (
              <button
                type="button"
                onClick={() => setItems([...items, { q: "", a: "" }])}
                className={cn(buttonSecondary, "text-xs")}
              >
                + Add question
              </button>
            )}
          </div>
        </>
      );
    }

    case "logos": {
      const items = block.items ?? [];
      const setItems = (next: LogoItem[]) => set({ items: next });
      const patchItem = (idx: number, patch: Partial<LogoItem>) =>
        setItems(items.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
      return (
        <>
          <TwoCol>
            <Field label="Title">
              <TextInput value={block.title ?? ""} onChange={(e) => set({ title: e.target.value })} />
            </Field>
            <Field label="Marquee">
              <SelectField
                value={block.marquee ? "yes" : "no"}
                onChange={(e) => set({ marquee: e.target.value === "yes" })}
              >
                <option value="no">Static grid</option>
                <option value="yes">Scrolling marquee</option>
              </SelectField>
            </Field>
          </TwoCol>
          <div className="space-y-2">
            <div className="text-sm text-muted">Logos</div>
            {items.map((l, idx) => (
              <ItemCard
                key={idx}
                onRemove={canWrite ? () => setItems(items.filter((_, i) => i !== idx)) : undefined}
              >
                <TwoCol>
                  <Field label="Name">
                    <TextInput value={l.name ?? ""} onChange={(e) => patchItem(idx, { name: e.target.value })} />
                  </Field>
                  <Field label="Link (optional)">
                    <TextInput value={l.href ?? ""} onChange={(e) => patchItem(idx, { href: e.target.value })} placeholder="https://…" />
                  </Field>
                </TwoCol>
                <Field label="Logo">
                  <ImagePicker
                    docId={docId}
                    role="logo"
                    value={l.image}
                    canWrite={canWrite}
                    uploadAction={uploadAction}
                    onChange={(v) =>
                      v ? patchItem(idx, { image: v }) : setItems(items.filter((_, i) => i !== idx))
                    }
                  />
                </Field>
              </ItemCard>
            ))}
            {canWrite && (
              <ImageAdder
                docId={docId}
                role="logo"
                uploadAction={uploadAction}
                onAdd={(v) => setItems([...items, { image: v }])}
                label="Add logo"
              />
            )}
          </div>
        </>
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Shared sub-editors
// ---------------------------------------------------------------------------

function TwoCol({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function AlignField({ value, onChange }: { value?: "left" | "center"; onChange: (v: string) => void }) {
  return (
    <Field label="Align">
      <SelectField value={value ?? "left"} onChange={(e) => onChange(e.target.value)}>
        <option value="left">Left</option>
        <option value="center">Center</option>
      </SelectField>
    </Field>
  );
}

function ColumnsSelect({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <SelectField value={String(value)} onChange={(e) => onChange(Number(e.target.value))}>
      {[2, 3, 4].map((n) => (
        <option key={n} value={n}>
          {n} columns
        </option>
      ))}
    </SelectField>
  );
}

function AccentField({ value, onChange }: { value?: Accent; onChange: (v: Accent | undefined) => void }) {
  return (
    <Field label="Accent">
      <AccentSelect value={value} onChange={onChange} />
    </Field>
  );
}

function AccentSelect({ value, onChange }: { value?: Accent; onChange: (v: Accent | undefined) => void }) {
  return (
    <SelectField
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || undefined) as Accent | undefined)}
    >
      <option value="">Default</option>
      {ACCENTS.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </SelectField>
  );
}

/** Card shell for a removable nested item with its own fields. */
function ItemCard({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/40 p-3">
      {onRemove && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove"
            className={cn(buttonGhost, "px-1.5 hover:text-danger")}
          >
            <Icons.close className="size-4" />
          </button>
        </div>
      )}
      {children}
    </div>
  );
}

/** Single-line removable row (stats). */
function ItemRow({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  return (
    <div className="flex flex-col items-stretch gap-2 rounded-lg border border-border bg-background/40 p-2 sm:flex-row sm:items-center">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className={cn(buttonGhost, "px-1.5 hover:text-danger")}
        >
          <Icons.close className="size-4" />
        </button>
      )}
    </div>
  );
}

function ButtonsEditor({
  value,
  canWrite,
  onChange,
}: {
  value: PageButton[];
  canWrite: boolean;
  onChange: (next: PageButton[]) => void;
}) {
  const patch = (idx: number, p: Partial<PageButton>) =>
    onChange(value.map((b, i) => (i === idx ? { ...b, ...p } : b)));
  return (
    <div className="space-y-2">
      <div className="text-sm text-muted">Buttons</div>
      {value.map((b, idx) => (
        <div key={idx} className="flex flex-col gap-2 rounded-lg border border-border bg-background/40 p-2 sm:flex-row sm:items-center">
          <TextInput
            value={b.label ?? ""}
            onChange={(e) => patch(idx, { label: e.target.value })}
            placeholder="Label"
            className="sm:flex-1"
          />
          <TextInput
            value={b.href ?? ""}
            onChange={(e) => patch(idx, { href: e.target.value })}
            placeholder="/join or https://…"
            className="sm:flex-1"
          />
          <SelectField
            value={b.variant ?? "pink"}
            onChange={(e) => patch(idx, { variant: e.target.value as ButtonVariant })}
            className="sm:w-28"
          >
            {BUTTON_VARIANTS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </SelectField>
          {canWrite && (
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
              aria-label="Remove button"
              className={cn(buttonGhost, "px-1.5 hover:text-danger")}
            >
              <Icons.close className="size-4" />
            </button>
          )}
        </div>
      ))}
      {canWrite && (
        <button
          type="button"
          onClick={() => onChange([...value, { label: "", href: "", variant: "pink" }])}
          className={cn(buttonSecondary, "text-xs")}
        >
          + Add button
        </button>
      )}
    </div>
  );
}

/** Compress a picked file (HEIC-aware) to a small WebP blob for upload. */
async function toUploadBlob(file: File): Promise<Blob> {
  const ready = isHeic(file) ? await heicToJpeg(file) : file;
  return fileToWebpBlob(ready);
}

/**
 * A single-image slot: shows a thumbnail when set (with Replace/Remove), else a
 * file picker. Uploads immediately to dsec-api and hands the resulting ImageRef
 * to `onChange`. Removing calls `onChange(undefined)`.
 */
function ImagePicker({
  docId,
  role,
  value,
  canWrite,
  uploadAction,
  onChange,
}: {
  docId: number;
  role: string;
  value?: ImageRef;
  canWrite: boolean;
  uploadAction: UploadPageImage;
  onChange: (v: ImageRef | undefined) => void;
}) {
  const [pending, start] = useTransition();

  const upload = (file: File) => {
    start(async () => {
      try {
        const blob = await toUploadBlob(file);
        const fd = new FormData();
        fd.set("role", role);
        if (value?.alt) fd.set("alt_text", value.alt);
        fd.set("file", blob, `${role}.webp`);
        const res = await uploadAction(docId, fd);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        onChange(res.image);
        toast.success("Image uploaded.");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  return (
    <div className="space-y-2">
      {value?.webp ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.webp}
            alt={value.alt ?? ""}
            className="h-16 w-24 shrink-0 rounded-md border border-border object-cover"
          />
          <div className="min-w-0 flex-1">
            <TextInput
              value={value.alt ?? ""}
              onChange={(e) => onChange({ ...value, alt: e.target.value })}
              placeholder="Alt text (accessibility)"
            />
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className={cn(buttonGhost, "shrink-0 px-1.5 hover:text-danger")}
              aria-label="Remove image"
            >
              <Icons.close className="size-4" />
            </button>
          )}
        </div>
      ) : (
        canWrite && (
          <FileButton pending={pending} onPick={upload} label={pending ? "Uploading…" : "Upload image"} />
        )
      )}
    </div>
  );
}

/** Add-another-image control for the gallery / logo strip arrays. */
function ImageAdder({
  docId,
  role,
  uploadAction,
  onAdd,
  label,
}: {
  docId: number;
  role: string;
  uploadAction: UploadPageImage;
  onAdd: (v: ImageRef) => void;
  label: string;
}) {
  const [pending, start] = useTransition();
  const upload = (file: File) => {
    start(async () => {
      try {
        const blob = await toUploadBlob(file);
        const fd = new FormData();
        fd.set("role", role);
        fd.set("file", blob, `${role}.webp`);
        const res = await uploadAction(docId, fd);
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        onAdd(res.image);
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };
  return <FileButton pending={pending} onPick={upload} label={pending ? "Uploading…" : label} />;
}

function FileButton({
  pending,
  onPick,
  label,
}: {
  pending: boolean;
  onPick: (file: File) => void;
  label: string;
}) {
  return (
    <label className={cn(buttonSecondary, "cursor-pointer text-xs", pending && "opacity-60")}>
      <Icons.camera className="size-4" />
      {label}
      <input
        type="file"
        accept="image/*,.heic,.heif"
        className="sr-only"
        disabled={pending}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}
