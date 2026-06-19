"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CheckboxField, Field, FormError, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { Badge, buttonSecondary } from "@/components/ui";
import { cn } from "@/lib/format";
import type { NotificationChannel } from "@/lib/notifications/types";
import { useActionToast } from "@/lib/use-action-toast";

import {
  disconnectTelegram,
  generateTelegramLink,
  sendTestNotificationAction,
  updateNotificationPrefs,
} from "./actions";

type Initial = {
  emailEnabled: boolean;
  emailAddress: string | null;
  discordEnabled: boolean;
  discordWebhookUrl: string | null;
  telegramEnabled: boolean;
  telegramLinked: boolean;
  notifyOnAssign: boolean;
  notifyDueDigest: boolean;
  notifyDueReminder: boolean;
  dueSoonDays: number;
  reminderLeadDays: number;
};

function TestButton({
  channel,
  onTest,
}: {
  channel: NotificationChannel;
  onTest: (channel: NotificationChannel) => void;
}) {
  return (
    <button type="button" onClick={() => onTest(channel)} className={cn(buttonSecondary, "text-xs")}>
      Send test
    </button>
  );
}

function ChannelCard({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

export function NotificationsForm({
  accountEmail,
  telegramConfigured,
  initial,
}: {
  accountEmail: string;
  telegramConfigured: boolean;
  initial: Initial;
}) {
  const [state, formAction] = useActionState(updateNotificationPrefs, undefined);
  useActionToast(state);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tgLink, setTgLink] = useState<string | null>(null);

  async function test(channel: NotificationChannel) {
    const res = await sendTestNotificationAction(channel);
    if (res?.ok) toast.success("Test sent — check that channel.");
    else toast.error(res?.error ?? "Test failed.");
  }

  async function connectTelegram() {
    const res = await generateTelegramLink();
    if (res.error || !res.link) {
      toast.error(res.error ?? "Couldn't start Telegram linking.");
      return;
    }
    setTgLink(res.link);
    window.open(res.link, "_blank", "noopener,noreferrer");
  }

  function disconnect() {
    startTransition(async () => {
      await disconnectTelegram();
      setTgLink(null);
      router.refresh();
      toast.success("Telegram disconnected.");
    });
  }

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <FormError>{state?.error}</FormError>

      {/* EMAIL */}
      <ChannelCard title="Email" badge={<Badge variant="success">Ready</Badge>}>
        <CheckboxField
          name="email_enabled"
          label="Email me notifications"
          defaultChecked={initial.emailEnabled}
        />
        <Field label="Send to" hint={`Leave blank to use your account email (${accountEmail}).`}>
          <TextInput
            name="email_address"
            type="email"
            defaultValue={initial.emailAddress ?? ""}
            placeholder={accountEmail}
          />
        </Field>
        <TestButton channel="email" onTest={test} />
      </ChannelCard>

      {/* DISCORD */}
      <ChannelCard
        title="Discord"
        description="Posts to a channel of your choice via a webhook — no bot needed."
      >
        <CheckboxField
          name="discord_enabled"
          label="Send to Discord"
          defaultChecked={initial.discordEnabled}
        />
        <Field
          label="Webhook URL"
          hint="In Discord: Channel → Edit channel → Integrations → Webhooks → New Webhook → Copy URL."
        >
          <TextInput
            name="discord_webhook_url"
            defaultValue={initial.discordWebhookUrl ?? ""}
            placeholder="https://discord.com/api/webhooks/…"
          />
        </Field>
        <TestButton channel="discord" onTest={test} />
      </ChannelCard>

      {/* TELEGRAM */}
      <ChannelCard
        title="Telegram"
        description="Get a direct message from the DSEC bot."
        badge={initial.telegramLinked ? <Badge variant="success">Connected</Badge> : undefined}
      >
        {!telegramConfigured ? (
          <p className="text-sm text-muted">
            Telegram isn’t set up on the server yet — ask an admin to configure the bot.
          </p>
        ) : initial.telegramLinked ? (
          <>
            <CheckboxField
              name="telegram_enabled"
              label="Send to Telegram"
              defaultChecked={initial.telegramEnabled}
            />
            <div className="flex flex-wrap gap-2">
              <TestButton channel="telegram" onTest={test} />
              <button
                type="button"
                onClick={disconnect}
                disabled={pending}
                className={cn(buttonSecondary, "text-xs")}
              >
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <button type="button" onClick={connectTelegram} className={buttonSecondary}>
              Connect Telegram
            </button>
            {tgLink && (
              <div className="space-y-2 rounded-lg border border-border bg-background p-3 text-sm">
                <p className="text-muted">
                  Telegram opened in a new tab — tap <span className="font-medium text-foreground">Start</span>{" "}
                  there, then come back and refresh.
                </p>
                <div className="flex flex-wrap gap-2">
                  <a href={tgLink} target="_blank" rel="noopener noreferrer" className={cn(buttonSecondary, "text-xs")}>
                    Open link again
                  </a>
                  <button
                    type="button"
                    onClick={() => router.refresh()}
                    className={cn(buttonSecondary, "text-xs")}
                  >
                    I’ve tapped Start — refresh
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </ChannelCard>

      {/* CATEGORIES */}
      <ChannelCard title="What to notify me about">
        <CheckboxField
          name="notify_on_assign"
          label="When a task is assigned to me (instant)"
          defaultChecked={initial.notifyOnAssign}
        />
        <div className="space-y-2 border-t border-border pt-4">
          <CheckboxField
            name="notify_due_digest"
            label="Daily digest of my upcoming & overdue tasks"
            defaultChecked={initial.notifyDueDigest}
          />
          <Field label="Include tasks due within (days)">
            <TextInput
              name="due_soon_days"
              type="number"
              min={1}
              max={30}
              defaultValue={initial.dueSoonDays}
              className="max-w-[8rem]"
            />
          </Field>
        </div>
        <div className="space-y-2 border-t border-border pt-4">
          <CheckboxField
            name="notify_due_reminder"
            label="Reminder before each task’s due date"
            defaultChecked={initial.notifyDueReminder}
          />
          <Field label="Remind me this many days before (0 = on the day)">
            <TextInput
              name="reminder_lead_days"
              type="number"
              min={0}
              max={30}
              defaultValue={initial.reminderLeadDays}
              className="max-w-[8rem]"
            />
          </Field>
        </div>
      </ChannelCard>

      <p className="text-xs text-muted">
        Tip: “Send test” uses your <span className="font-medium">saved</span> settings — save first, then
        test a channel.
      </p>
      <SubmitButton>Save notification settings</SubmitButton>
    </form>
  );
}
