import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { getPrefsForUser } from "@/lib/notifications/prefs";

import { NotificationsForm } from "./notifications-form";

export default async function NotificationsSettingsPage() {
  const user = await requireUser();
  const prefs = await getPrefsForUser(user.id);
  const telegramConfigured = Boolean(
    process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME,
  );

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Choose how DSEC reaches you when a task is assigned to you or a deadline is near. Saved to your account only."
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Notifications" }]}
      />
      <NotificationsForm
        accountEmail={user.email}
        telegramConfigured={telegramConfigured}
        initial={{
          emailEnabled: prefs.emailEnabled,
          emailAddress: prefs.emailAddress,
          discordEnabled: prefs.discordEnabled,
          discordWebhookUrl: prefs.discordWebhookUrl,
          telegramEnabled: prefs.telegramEnabled,
          telegramLinked: Boolean(prefs.telegramChatId),
          notifyOnAssign: prefs.notifyOnAssign,
          notifyDueDigest: prefs.notifyDueDigest,
          notifyDueReminder: prefs.notifyDueReminder,
          dueSoonDays: prefs.dueSoonDays,
          reminderLeadDays: prefs.reminderLeadDays,
        }}
      />
    </>
  );
}
