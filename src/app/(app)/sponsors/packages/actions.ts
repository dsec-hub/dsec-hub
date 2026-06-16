"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { sponsorPackages } from "@/db/schema";
import { requireWrite } from "@/lib/dal";
import { bool, int, str } from "@/lib/form-data";
import { revalidateWebsite } from "@/lib/revalidate-website";
import type { ActionResult } from "@/lib/undo-types";

export type FormState = ActionResult;

function parsePackage(fd: FormData) {
  const rawIncludes = str(fd, "includes") ?? "";
  const includes = rawIncludes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return {
    name: str(fd, "name") ?? "",
    pitch: str(fd, "pitch"),
    price: str(fd, "price"),
    includes,
    featured: bool(fd, "featured"),
    isVisible: bool(fd, "is_visible"),
    displayOrder: int(fd, "display_order") ?? 0,
  };
}

async function revalidate() {
  revalidatePath("/sponsors/packages");
  await revalidateWebsite("packages");
}

export async function createPackage(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireWrite("sponsors");
  const values = parsePackage(fd);
  if (!values.name) return { error: "Name is required." };
  await db.insert(sponsorPackages).values(values);
  await revalidate();
  return { ok: true, message: "Package created." };
}

export async function updatePackage(
  id: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  await requireWrite("sponsors");
  const values = parsePackage(fd);
  if (!values.name) return { error: "Name is required." };
  await db
    .update(sponsorPackages)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(sponsorPackages.id, id));
  await revalidate();
  return { ok: true, message: "Package updated." };
}

export async function deletePackage(id: number): Promise<FormState> {
  await requireWrite("sponsors");
  await db.delete(sponsorPackages).where(eq(sponsorPackages.id, id));
  await revalidate();
  return { ok: true, message: "Package deleted." };
}
