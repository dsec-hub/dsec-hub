/** Vercel rejects any Server Action request body above this, before our code
 *  runs. It is the real ceiling regardless of what next.config.ts declares. */
export const MAX_UPLOAD_BYTES = 4_000_000; // 4 MB, just under Vercel's 4.5 MB
export const MAX_UPLOAD_LABEL = "4 MB";
