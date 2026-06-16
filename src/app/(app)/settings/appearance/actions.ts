"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { appUser } from "@/db/schema";
import { requireUser } from "@/lib/dal";
import { str } from "@/lib/form-data";
import {
  DEFAULT_BODY_FONT_KEY,
  DEFAULT_BODY_WEIGHT_KEY,
  DEFAULT_TITLE_FONT_KEY,
  DEFAULT_TITLE_WEIGHT_KEY,
  normalizeFontKey,
  normalizeHex,
  normalizeWeightKey,
} from "@/lib/theme";

export type AppearanceState = { error?: string; ok?: boolean } | undefined;

/**
 * Save the signed-in user's own theme (accent colour + title/body fonts).
 * Stored per user on `app_user`; null on any dimension means "use the brand
 * default". An empty/`default` value resets that dimension.
 */
export async function updateAppearance(
  _prev: AppearanceState,
  fd: FormData,
): Promise<AppearanceState> {
  const user = await requireUser();

  const rawAccent = str(fd, "accent");
  let themeAccent: string | null = null;
  if (rawAccent && rawAccent !== "default") {
    const hex = normalizeHex(rawAccent);
    if (!hex) return { error: "Pick a valid accent colour (a #RRGGBB hex)." };
    themeAccent = hex;
  }

  const rawBackground = str(fd, "background");
  let themeBackground: string | null = null;
  if (rawBackground && rawBackground !== "default") {
    const hex = normalizeHex(rawBackground);
    if (!hex) return { error: "Pick a valid background colour (a #RRGGBB hex)." };
    themeBackground = hex;
  }

  const themeFontTitle = normalizeFontKey(str(fd, "font_title"), DEFAULT_TITLE_FONT_KEY);
  const themeFontBody = normalizeFontKey(str(fd, "font_body"), DEFAULT_BODY_FONT_KEY);
  const themeWeightTitle = normalizeWeightKey(str(fd, "weight_title"), DEFAULT_TITLE_WEIGHT_KEY);
  const themeWeightBody = normalizeWeightKey(str(fd, "weight_body"), DEFAULT_BODY_WEIGHT_KEY);

  await db
    .update(appUser)
    .set({
      themeAccent,
      themeBackground,
      themeFontTitle,
      themeFontBody,
      themeWeightTitle,
      themeWeightBody,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(appUser.id, user.id));

  // The override is applied in the (app) layout, so revalidate the whole app.
  revalidatePath("/", "layout");
  return { ok: true };
}
