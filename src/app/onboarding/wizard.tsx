"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";

import { Field, FormError, TextArea, TextInput } from "@/components/form";
import { Icons } from "@/components/icons";
import { buttonPrimary, buttonSecondary } from "@/components/ui";
import { cn, initials } from "@/lib/format";
import { cropToBlob, isHeic, toDisplayable } from "@/lib/image-crop";

import { finishOnboarding, uploadOwnPhoto, type OnboardingProfile } from "./actions";

const LINK_FIELDS: { key: keyof OnboardingProfile; label: string; placeholder: string }[] = [
  { key: "website", label: "Website / portfolio", placeholder: "https://…" },
  { key: "linkedin", label: "LinkedIn", placeholder: "profile URL" },
  { key: "github", label: "GitHub", placeholder: "username" },
  { key: "instagram", label: "Instagram", placeholder: "@handle" },
  { key: "discord", label: "Discord", placeholder: "username" },
];

const STEPS = ["Welcome", "Details", "Photo", "Links"] as const;

// Per-step header copy. Step 0's title is personalised at render time.
const HEADINGS: { title: string; sub: string }[] = [
  { title: "Welcome to DSEC", sub: "Let's set up your committee profile. It takes about a minute." },
  { title: "A bit about you", sub: "This is what the committee and the public team page will see." },
  { title: "Add a profile photo", sub: "A square headshot that shows up on the public team page." },
  { title: "Ways to reach you", sub: "Add at least one link. You can change these any time in Settings." },
];

// Run layout effects on the client only — this component is SSR'd inside its
// "use client" boundary, and useLayoutEffect warns on the server.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return (
    document.documentElement.dataset.motion === "reduce" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

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

export function OnboardingWizard({
  email,
  firstName,
  initial,
  initialPhotoUrl,
}: {
  email: string;
  firstName: string | null;
  initial: OnboardingProfile;
  initialPhotoUrl: string | null;
}) {
  const [step, setStep] = useState(0);
  // 0 = first paint (settle in place), 1 = advanced, -1 = went back.
  const [dir, setDir] = useState<0 | 1 | -1>(0);
  const [form, setForm] = useState<OnboardingProfile>(initial);
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl);
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();
  const stepRef = useRef<HTMLDivElement>(null);

  const set = (key: keyof OnboardingProfile, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const hasLink = LINK_FIELDS.some(({ key }) => (form[key] ?? "").trim());

  // Per-step gate for the primary button (matched server-side on finish).
  const canAdvance =
    step === 0 ? true
    : step === 1 ? !!form.name.trim() && !!form.bio.trim()
    : step === 2 ? !!photoUrl
    : hasLink;

  const lastStep = step === STEPS.length - 1;

  const next = () => {
    setError(undefined);
    setDir(1);
    if (!lastStep) setStep((s) => s + 1);
    else finish();
  };
  const back = () => {
    setError(undefined);
    setDir(-1);
    setStep((s) => Math.max(0, s - 1));
  };

  const finish = () => {
    setError(undefined);
    start(async () => {
      const res = await finishOnboarding(form);
      // On success the action redirects; only an error returns here.
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      }
    });
  };

  // After a navigation, move focus to the new step so keyboard / screen-reader
  // users land on its content rather than staying on a button that relabelled.
  useEffect(() => {
    if (dir === 0) return; // skip the first paint
    stepRef.current?.focus({ preventScroll: true });
  }, [step, dir]);

  const title = step === 0 ? (firstName ? `Welcome, ${firstName}` : HEADINGS[0].title) : HEADINGS[step].title;

  return (
    <div className="space-y-7">
      <header className="space-y-4 text-center">
        <p className="font-title text-xs font-semibold tracking-[0.22em] text-accent-text">DSEC</p>
        <div className="space-y-1.5">
          <h1 className="text-balance text-[1.6rem] font-semibold leading-tight">
            {title}
            {step === 0 && (
              <span className="onb-wave ml-1.5" aria-hidden>
                👋
              </span>
            )}
          </h1>
          <p className="mx-auto max-w-sm text-pretty text-sm text-muted">{HEADINGS[step].sub}</p>
        </div>
        <Stepper step={step} />
      </header>

      <p className="sr-only" aria-live="polite">
        Step {step + 1} of {STEPS.length}: {HEADINGS[step].title}
      </p>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7">
        <div className={cn(error && "mb-4")}>
          <FormError>{error}</FormError>
        </div>

        <AutoHeight trigger={`${step}:${error ? 1 : 0}`}>
          <div
            key={step}
            ref={stepRef}
            tabIndex={-1}
            className={cn(
              "outline-none",
              dir === 0 ? "animate-pop-in" : dir === 1 ? "onb-step-fwd" : "onb-step-back",
            )}
          >
            {step === 0 && <WelcomeStep email={email} name={form.name} />}
            {step === 1 && <DetailsStep form={form} set={set} />}
            {step === 2 && <PhotoStep photoUrl={photoUrl} onUploaded={setPhotoUrl} />}
            {step === 3 && <LinksStep form={form} set={set} hasLink={hasLink} />}
          </div>
        </AutoHeight>
      </div>

      <div className="flex items-center justify-between gap-3">
        {step > 0 ? (
          <button type="button" className={cn(buttonSecondary, "onb-btn")} onClick={back} disabled={pending}>
            <Icons.collapse className="size-4" /> Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          className={cn(buttonPrimary, "onb-btn group px-4")}
          onClick={next}
          disabled={!canAdvance || pending}
          aria-busy={pending}
        >
          {pending ? (
            <>
              <Spinner /> Finishing…
            </>
          ) : lastStep ? (
            <>
              <Icons.check className="size-4" /> Finish &amp; enter
            </>
          ) : (
            <>
              {step === 0 ? "Get started" : "Continue"}
              <Icons.arrowRight className="size-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Animates the card's height between steps so it never jumps. A pixel height is
 * held only for the duration of the transition (clipping any briefly-overflowing
 * content); at rest the wrapper is height:auto with visible overflow, so focus
 * rings on edge inputs never clip. Honours reduced motion (snaps instantly).
 */
function AutoHeight({ trigger, children }: { trigger: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<number | null>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nextH = el.scrollHeight;
    if (prev.current === null) {
      prev.current = nextH;
      return;
    }
    if (prev.current === nextH) return;
    if (prefersReducedMotion()) {
      prev.current = nextH;
      setHeight("auto");
      return;
    }
    setHeight(prev.current); // pin to the outgoing height
    void el.offsetHeight; // force reflow so the browser registers the start
    requestAnimationFrame(() => setHeight(nextH));
    prev.current = nextH;
  }, [trigger]);

  return (
    <div
      ref={ref}
      className="onb-autoheight"
      style={{ height, overflow: height === "auto" ? undefined : "hidden" }}
      onTransitionEnd={(e) => {
        if (e.propertyName === "height") setHeight("auto");
      }}
    >
      {children}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mx-auto flex max-w-sm items-start" aria-hidden>
      {STEPS.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <Fragment key={label}>
            {i > 0 && (
              <li className="relative mt-[11px] h-px flex-1 bg-border">
                <span
                  className="absolute inset-0 origin-left bg-accent transition-transform duration-300 ease-out"
                  style={{ transform: `scaleX(${i <= step ? 1 : 0})` }}
                />
              </li>
            )}
            <li className="flex flex-col items-center gap-2 sm:w-[4.5rem]">
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full border text-[11px] font-semibold tabular-nums transition-colors duration-200",
                  done && "border-accent bg-accent text-accent-foreground",
                  current && "border-accent text-accent-text",
                  !done && !current && "border-border text-muted/60",
                )}
              >
                {done ? <Icons.check key="done" className="onb-check size-3.5" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-[11px] leading-none transition-colors sm:block",
                  current ? "font-medium text-foreground" : "text-muted/70",
                )}
              >
                {label}
              </span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

function WelcomeStep({ email, name }: { email: string; name: string }) {
  const items = [
    { icon: <Icons.people className="size-4" />, title: "A bit about you", desc: "Your name and a one-line bio." },
    { icon: <Icons.camera className="size-4" />, title: "A profile photo", desc: "A square headshot, cropped right here." },
    { icon: <Icons.link className="size-4" />, title: "Ways to reach you", desc: "A link or two, like GitHub or LinkedIn." },
  ];
  return (
    <div className="space-y-5">
      <ol>
        {items.map((it, i) => (
          <li key={it.title} className="relative flex gap-3.5 pb-4 last:pb-0">
            {i < items.length - 1 && (
              <span className="absolute left-[17.5px] top-9 h-[calc(100%-1.75rem)] w-px bg-border" aria-hidden />
            )}
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent-text">
              {it.icon}
            </span>
            <span className="min-w-0 pt-px">
              <span className="block text-sm font-medium text-foreground">{it.title}</span>
              <span className="block text-xs text-muted">{it.desc}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2.5 rounded-xl bg-elevated px-3 py-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface text-[11px] font-semibold text-accent-text ring-1 ring-border">
          {initials(name) || email[0]?.toUpperCase() || "?"}
        </span>
        <span className="min-w-0 truncate text-xs text-muted">
          Signed in as <span className="font-medium text-foreground">{email}</span>
        </span>
      </div>
    </div>
  );
}

function DetailsStep({
  form,
  set,
}: {
  form: OnboardingProfile;
  set: (key: keyof OnboardingProfile, value: string) => void;
}) {
  const count = form.bio.length;
  return (
    <div className="space-y-5">
      <Field label="Full name" hint="Shown to the committee and on the public team page.">
        <TextInput
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          autoComplete="name"
          placeholder="Jane Citizen"
        />
      </Field>
      <Field label="Short bio" hint="One line for the team page: your role, interests, or a fun fact.">
        <div className="relative">
          <TextArea
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            maxLength={200}
            placeholder="Second-year CS student who loves CTFs and bad puns."
            className="pb-7"
          />
          <span
            className={cn(
              "pointer-events-none absolute bottom-2.5 right-3 text-[11px] tabular-nums transition-colors",
              count > 180 ? "text-warning" : "text-muted/60",
            )}
          >
            {count}/200
          </span>
        </div>
      </Field>
    </div>
  );
}

/** Pick / drag → square-crop → upload a single headshot. Uploads immediately
 * (via the self-scoped action) and previews the cropped blob locally; the parent
 * tracks whether a photo now exists for the per-step gate. */
function PhotoStep({
  photoUrl,
  onUploaded,
}: {
  photoUrl: string | null;
  onUploaded: (url: string | null) => void;
}) {
  const [src, setSrc] = useState<string | null>(null); // image being cropped
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [converting, setConverting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [pending, start] = useTransition();

  // Revoke the crop-source object URL when it changes / unmounts.
  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  const handleFiles = (files: FileList | File[] | null | undefined) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") && !isHeic(file)) {
      toast.error("That doesn't look like an image.");
      return;
    }
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    if (!isHeic(file)) {
      setSrc(URL.createObjectURL(file));
      return;
    }
    setConverting(true);
    void toDisplayable([file])
      .then(([ready]) => setSrc(URL.createObjectURL(ready)))
      .catch((err: unknown) =>
        toast.error(`Couldn't read that HEIC photo. ${(err as Error).message}`),
      )
      .finally(() => setConverting(false));
  };

  const onCropComplete = useCallback((_a: Area, pixels: Area) => setArea(pixels), []);

  const upload = () => {
    if (!src || !area) return;
    start(async () => {
      try {
        const blob = await cropToBlob(src, area);
        const fd = new FormData();
        fd.set("file", blob, "photo.webp");
        const res = await uploadOwnPhoto(undefined, fd);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        onUploaded(URL.createObjectURL(blob));
        setSrc(null);
        setJustSaved(true);
        toast.success("Photo saved.");
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  // Cropping an image right now.
  if (src) {
    return (
      <div className="space-y-4">
        <div className="relative h-72 w-full overflow-hidden rounded-xl bg-elevated ring-1 ring-border">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <label className="flex items-center gap-3 text-xs text-muted">
          <span className="shrink-0">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="h-1 w-full accent-[var(--color-accent)]"
          />
        </label>
        <p className="text-center text-xs text-muted/70">Drag to reposition, scroll or pinch to zoom.</p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className={cn(buttonSecondary, "onb-btn")}
            onClick={() => setSrc(null)}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(buttonPrimary, "onb-btn")}
            onClick={upload}
            disabled={pending || !area}
            aria-busy={pending}
          >
            {pending ? (
              <>
                <Spinner /> Uploading…
              </>
            ) : (
              <>
                <Icons.check className="size-4" /> Use this photo
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Idle: a circular drop target showing the current photo (if any) + a picker.
  return (
    <div className="flex flex-col items-center gap-4 py-1 text-center">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onAnimationEnd={() => setJustSaved(false)}
        className={cn(
          "group relative grid size-36 cursor-pointer place-items-center overflow-hidden rounded-full transition-[transform,border-color] duration-200",
          photoUrl ? "border border-border" : "border-2 border-dashed border-border hover:border-accent",
          dragging && "scale-[1.03] border-accent",
          justSaved && "onb-ring-pulse",
        )}
      >
        {photoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Your profile photo" className="h-full w-full object-cover" />
            <span className="absolute inset-0 grid place-items-center bg-foreground/45 text-xs font-medium text-white opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
              Change photo
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-muted transition-colors group-hover:text-accent-text">
            <Icons.camera className="size-7" />
            <span className="px-6 text-xs leading-snug">
              {dragging ? "Drop to upload" : "Drag a photo or click to choose"}
            </span>
          </span>
        )}
        <input type="file" accept="image/*,.heic,.heif" onChange={(e) => handleFiles(e.target.files)} className="hidden" />
      </label>

      {photoUrl && !converting && (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
          <Icons.check className="size-3.5" /> Looking good
        </span>
      )}
      {converting && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Spinner className="size-3" /> Converting HEIC photo…
        </p>
      )}
      {!photoUrl && !converting && (
        <p className="max-w-xs text-xs text-muted">A clear, square headshot works best. JPG, PNG or HEIC.</p>
      )}
    </div>
  );
}

function LinksStep({
  form,
  set,
  hasLink,
}: {
  form: OnboardingProfile;
  set: (key: keyof OnboardingProfile, value: string) => void;
  hasLink: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {LINK_FIELDS.map(({ key, label, placeholder }) => (
          <Field key={key} label={label}>
            <TextInput
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              placeholder={placeholder}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </Field>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span
          className={cn(
            "grid size-4 shrink-0 place-items-center rounded-full transition-colors duration-200",
            hasLink ? "bg-success text-white" : "bg-elevated text-muted/50",
          )}
        >
          {hasLink ? <Icons.check className="size-3" /> : <span className="size-1 rounded-full bg-current" />}
        </span>
        <span className={cn("transition-colors", hasLink ? "text-foreground" : "text-muted")}>
          {hasLink ? "That's enough to finish. Add more if you like." : "Add at least one link to continue."}
        </span>
      </div>
      <Field label="Student ID" hint="Optional. Links your DUSA club membership.">
        <TextInput
          value={form.studentId}
          onChange={(e) => set("studentId", e.target.value)}
          placeholder="220123456"
          inputMode="numeric"
        />
      </Field>
    </div>
  );
}
