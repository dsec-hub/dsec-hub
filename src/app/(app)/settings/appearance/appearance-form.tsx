"use client";

import { useActionState, useState } from "react";

import { Field, FormError, SelectField } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/format";
import { useActionToast } from "@/lib/use-action-toast";
import {
  ACCENT_PRESETS,
  BACKGROUND_PRESETS,
  DEFAULT_ACCENT,
  DEFAULT_BODY_FONT_KEY,
  DEFAULT_BODY_WEIGHT_KEY,
  DEFAULT_TITLE_FONT_KEY,
  DEFAULT_TITLE_WEIGHT_KEY,
  FONT_OPTIONS,
  WEIGHT_OPTIONS,
  accentForeground,
  fontByKey,
  normalizeHex,
  weightByKey,
} from "@/lib/theme";
import { updateAppearance } from "./actions";
import { DisplaySizeControl, MotionControl } from "./client-prefs";
import { ThemeModeControl } from "./theme-mode-control";

function FontSelect({
  value,
  onChange,
  defaultKey,
}: {
  value: string;
  onChange: (v: string) => void;
  defaultKey: string;
}) {
  return (
    <SelectField value={value} onChange={(e) => onChange(e.target.value)}>
      {FONT_OPTIONS.map((f) => (
        <option key={f.key} value={f.key}>
          {f.label}
          {f.key === defaultKey ? " (default)" : ""}
        </option>
      ))}
    </SelectField>
  );
}

function WeightSelect({
  value,
  onChange,
  defaultKey,
}: {
  value: string;
  onChange: (v: string) => void;
  defaultKey: string;
}) {
  return (
    <SelectField value={value} onChange={(e) => onChange(e.target.value)}>
      {WEIGHT_OPTIONS.map((w) => (
        <option key={w.key} value={w.key}>
          {w.label}
          {w.key === defaultKey ? " (default)" : ""}
        </option>
      ))}
    </SelectField>
  );
}

// Swatch row + custom-hex picker, shared by the accent and background controls.
// `value` is "default" (use the brand per-mode default) or a #rrggbb hex.
function ColorField({
  value,
  onChange,
  presets,
  defaultStyle,
  customSeed,
}: {
  value: string;
  onChange: (v: string) => void;
  presets: { label: string; hex: string }[];
  defaultStyle: React.CSSProperties;
  customSeed: string;
}) {
  const isCustom = value !== "default" && !presets.some((p) => p.hex === value);
  const customHex = normalizeHex(value) ?? customSeed;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button
        type="button"
        title="Default"
        aria-label="Default"
        onClick={() => onChange("default")}
        className={cn(
          "h-8 w-8 rounded-full border transition-transform",
          value === "default"
            ? "scale-110 border-foreground ring-2 ring-foreground/30"
            : "border-border hover:scale-105",
        )}
        style={defaultStyle}
      />
      {presets.map((p) => {
        const selected = value === p.hex;
        return (
          <button
            key={p.hex}
            type="button"
            title={p.label}
            aria-label={p.label}
            onClick={() => onChange(p.hex)}
            className={cn(
              "h-8 w-8 rounded-full border transition-transform",
              selected
                ? "scale-110 border-foreground ring-2 ring-foreground/30"
                : "border-border hover:scale-105",
            )}
            style={{ background: p.hex }}
          />
        );
      })}
      <label
        className={cn(
          "relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs",
          isCustom ? "border-foreground text-foreground" : "border-border text-muted",
        )}
      >
        <span
          className="h-4 w-4 rounded-full border border-border"
          style={{ background: isCustom ? customHex : "conic-gradient(red,orange,yellow,green,blue,violet,red)" }}
        />
        Custom
        <input
          type="color"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={customHex}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
        />
      </label>
    </div>
  );
}

export function AppearanceForm({
  initialAccent,
  initialBackground,
  initialFontTitle,
  initialFontBody,
  initialWeightTitle,
  initialWeightBody,
}: {
  initialAccent: string | null;
  initialBackground: string | null;
  initialFontTitle: string | null;
  initialFontBody: string | null;
  initialWeightTitle: string | null;
  initialWeightBody: string | null;
}) {
  const [state, formAction] = useActionState(updateAppearance, undefined);
  useActionToast(state);

  // "default" = use the brand default (stored as null); otherwise a #hex.
  const [accent, setAccent] = useState<string>(initialAccent ?? "default");
  const [background, setBackground] = useState<string>(initialBackground ?? "default");
  const [titleFont, setTitleFont] = useState<string>(initialFontTitle ?? DEFAULT_TITLE_FONT_KEY);
  const [bodyFont, setBodyFont] = useState<string>(initialFontBody ?? DEFAULT_BODY_FONT_KEY);
  const [titleWeight, setTitleWeight] = useState<string>(initialWeightTitle ?? DEFAULT_TITLE_WEIGHT_KEY);
  const [bodyWeight, setBodyWeight] = useState<string>(initialWeightBody ?? DEFAULT_BODY_WEIGHT_KEY);

  const previewHex = accent === "default" ? DEFAULT_ACCENT : normalizeHex(accent) ?? DEFAULT_ACCENT;
  const previewBg = background === "default" ? null : normalizeHex(background);
  const titleVar = fontByKey(titleFont).cssVar;
  const bodyVar = fontByKey(bodyFont).cssVar;
  const titleWeightVal = weightByKey(titleWeight, DEFAULT_TITLE_WEIGHT_KEY).value;
  const bodyWeightVal = weightByKey(bodyWeight, DEFAULT_BODY_WEIGHT_KEY).value;

  // The "Default" background swatch follows the active light/dark mode, so signal
  // that with a split fill rather than a single colour.
  const bgDefaultStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, #f7f8fa 0 50%, #0a0a0c 50% 100%)",
  };

  return (
    <form action={formAction} className="max-w-2xl space-y-7">
      <FormError>{state?.error}</FormError>

      {/* values submitted to the server action */}
      <input type="hidden" name="accent" value={accent} />
      <input type="hidden" name="background" value={background} />
      <input type="hidden" name="font_title" value={titleFont} />
      <input type="hidden" name="font_body" value={bodyFont} />
      <input type="hidden" name="weight_title" value={titleWeight} />
      <input type="hidden" name="weight_body" value={bodyWeight} />

      <Field label="Colour scheme" hint="Stored on this device — applies before the page paints, so there's no flash.">
        <div>
          <ThemeModeControl />
        </div>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Display size" hint="Scales the whole interface. Stored on this device.">
          <div>
            <DisplaySizeControl />
          </div>
        </Field>
        <Field label="Motion" hint="“Reduced” minimises animation; “System” follows your OS.">
          <div>
            <MotionControl />
          </div>
        </Field>
      </div>

      <Field label="Accent colour">
        <ColorField
          value={accent}
          onChange={setAccent}
          presets={ACCENT_PRESETS}
          defaultStyle={{ background: DEFAULT_ACCENT }}
          customSeed={previewHex}
        />
      </Field>

      <Field label="Background" hint="The page floor behind the content. A single colour for both light and dark.">
        <ColorField
          value={background}
          onChange={setBackground}
          presets={BACKGROUND_PRESETS}
          defaultStyle={bgDefaultStyle}
          customSeed={previewBg ?? "#15171c"}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Title font">
          <FontSelect value={titleFont} onChange={setTitleFont} defaultKey={DEFAULT_TITLE_FONT_KEY} />
        </Field>
        <Field label="Body font">
          <FontSelect value={bodyFont} onChange={setBodyFont} defaultKey={DEFAULT_BODY_FONT_KEY} />
        </Field>
        <Field label="Title weight">
          <WeightSelect value={titleWeight} onChange={setTitleWeight} defaultKey={DEFAULT_TITLE_WEIGHT_KEY} />
        </Field>
        <Field label="Body weight">
          <WeightSelect value={bodyWeight} onChange={setBodyWeight} defaultKey={DEFAULT_BODY_WEIGHT_KEY} />
        </Field>
      </div>

      {/* Live preview — content floats on a surface card over the chosen page
          floor, mirroring the real app shell. */}
      <div
        className="rounded-xl border border-border p-4"
        style={previewBg ? { background: previewBg } : undefined}
      >
        <div className="mb-1 px-1 text-xs uppercase tracking-wider text-muted">Preview</div>
        <div
          className="rounded-lg border border-border bg-surface p-5"
          style={{ fontFamily: `var(${bodyVar}), ui-sans-serif, system-ui, sans-serif` }}
        >
          <div
            className="mb-3 text-xl"
            style={{
              fontFamily: `var(${titleVar}), ui-monospace, monospace`,
              fontWeight: titleWeightVal,
              letterSpacing: "-0.01em",
            }}
          >
            DSEC Exec Dashboard
          </div>
          <p className="mb-4 text-sm text-muted" style={{ fontWeight: bodyWeightVal }}>
            The quick brown fox jumps over the lazy dog — 0123456789.
          </p>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium"
              style={{ background: previewHex, color: accentForeground(previewHex) }}
            >
              Primary action
            </span>
            <span className="text-sm font-medium" style={{ color: previewHex }}>
              Accent link
            </span>
          </div>
        </div>
      </div>

      <SubmitButton>Save appearance</SubmitButton>
    </form>
  );
}
