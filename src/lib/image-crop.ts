// Client-side image helpers shared by the media manager and the onboarding
// photo step: HEIC→JPEG decoding, interactive-crop export, and whole-image
// downscale. All pure (browser-only) functions — no React, no DB.

import type { Area } from "react-easy-crop";

// Cap the exported longest side so uploads stay small. Mirrors the server's
// MEDIA_MAX_DIMENSION (the API re-caps anyway), keeping bodies well under the
// Server Action limit. The API still produces the final WebP + PNG derivatives.
export const MAX_OUTPUT_DIMENSION = 2000;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("could not load image"));
    img.src = src;
  });
}

// iPhones shoot HEIC/HEIF by default, which Chrome & Firefox can't decode in an
// <img> or <canvas> — so both the crop preview and our canvas compression fail
// on them. Convert HEIC → JPEG up front and the rest of the pipeline treats it
// like any other photo. The decoder (heic2any wraps libheif, ~1.5 MB) is loaded
// lazily, so it costs nothing on the bundle unless an Apple photo is picked.
const HEIC_EXT = /\.(heic|heif)$/i;

export function isHeic(file: File): boolean {
  // Browsers often report an empty or octet-stream type for HEIC, so fall back
  // to the extension. Matches image/heic, image/heif and their -sequence forms.
  return /^image\/hei[cf]/i.test(file.type) || HEIC_EXT.test(file.name);
}

export async function heicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(out) ? out[0] : out;
  const base = file.name.replace(HEIC_EXT, "") || "image";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

/** Convert any HEIC/HEIF picks to JPEG; pass everything else through untouched. */
export function toDisplayable(files: File[]): Promise<File[]> {
  return Promise.all(files.map((f) => (isHeic(f) ? heicToJpeg(f) : Promise.resolve(f))));
}

/** Draw the selected crop region to a canvas and export a compressed WebP blob.
 *  WebP @0.9 is a fraction of an equivalent PNG, so the upload comfortably fits
 *  the Server Action body limit; the API still emits the lossless-ish PNG. */
export async function cropToBlob(src: string, area: Area): Promise<Blob> {
  const image = await loadImage(src);
  const cw = Math.max(1, Math.round(area.width));
  const ch = Math.max(1, Math.round(area.height));
  const scale = Math.min(1, MAX_OUTPUT_DIMENSION / Math.max(cw, ch));
  const ow = Math.max(1, Math.round(cw * scale));
  const oh = Math.max(1, Math.round(ch * scale));
  const canvas = document.createElement("canvas");
  canvas.width = ow;
  canvas.height = oh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas not supported");
  ctx.drawImage(image, Math.round(area.x), Math.round(area.y), cw, ch, 0, 0, ow, oh);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("crop export failed"))),
      "image/webp",
      0.9,
    ),
  );
}

/** Downscale a whole image (no crop) to the dimension cap and export WebP@0.9 —
 *  the bulk path, where there's no interactive crop. Aspect ratio is preserved;
 *  the API still emits the final WebP + PNG derivatives. */
export async function fileToWebpBlob(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const scale = Math.min(
      1,
      MAX_OUTPUT_DIMENSION / Math.max(image.width, image.height),
    );
    const ow = Math.max(1, Math.round(image.width * scale));
    const oh = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = ow;
    canvas.height = oh;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas not supported");
    ctx.drawImage(image, 0, 0, ow, oh);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("image export failed"))),
        "image/webp",
        0.9,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
