import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { appUser, notificationPref } from "@/db/schema";

import { DEFAULT_PREFS, type NotificationPrefs } from "./types";

/** The signed-in user's notification prefs, or all-defaults when no row exists. */
export async function getPrefsForUser(userId: number): Promise<NotificationPrefs> {
  const [row] = await db
    .select()
    .from(notificationPref)
    .where(eq(notificationPref.userId, userId))
    .limit(1);
  if (!row) return { ...DEFAULT_PREFS };
  return {
    emailEnabled: row.emailEnabled,
    emailAddress: row.emailAddress,
    discordEnabled: row.discordEnabled,
    discordWebhookUrl: row.discordWebhookUrl,
    telegramEnabled: row.telegramEnabled,
    telegramChatId: row.telegramChatId,
    telegramLinkCode: row.telegramLinkCode,
    telegramLinkedAt: row.telegramLinkedAt,
    notifyOnAssign: row.notifyOnAssign,
    notifyDueDigest: row.notifyDueDigest,
    notifyDueReminder: row.notifyDueReminder,
    dueSoonDays: row.dueSoonDays,
    reminderLeadDays: row.reminderLeadDays,
  };
}

export type NotifyContext = { prefs: NotificationPrefs; email: string; name: string | null };

/** Prefs + the account email/name needed to address a notification. Null if the user is gone/inactive. */
export async function getUserNotifyContext(userId: number): Promise<NotifyContext | null> {
  const [u] = await db
    .select({ email: appUser.email, name: appUser.name, isActive: appUser.isActive })
    .from(appUser)
    .where(eq(appUser.id, userId))
    .limit(1);
  if (!u || !u.isActive) return null;
  const prefs = await getPrefsForUser(userId);
  return { prefs, email: u.email, name: u.name };
}

/**
 * Upsert a user's prefs. Creates the row on first save, then merges the given
 * fields. Always stamps updated_at.
 */
export async function upsertPrefs(
  userId: number,
  patch: Partial<Omit<NotificationPrefs, never>>,
): Promise<void> {
  const now = new Date().toISOString();
  const [existing] = await db
    .select({ id: notificationPref.id })
    .from(notificationPref)
    .where(eq(notificationPref.userId, userId))
    .limit(1);
  if (existing) {
    await db
      .update(notificationPref)
      .set({ ...patch, updatedAt: now })
      .where(eq(notificationPref.userId, userId));
  } else {
    await db.insert(notificationPref).values({ userId, ...patch, updatedAt: now });
  }
}

/** Map a roster person (a task assignee) to an ACTIVE login user id, or null. */
export async function userIdForPerson(personId: number): Promise<number | null> {
  const [u] = await db
    .select({ id: appUser.id })
    .from(appUser)
    .where(and(eq(appUser.personId, personId), eq(appUser.isActive, true)))
    .limit(1);
  return u?.id ?? null;
}
