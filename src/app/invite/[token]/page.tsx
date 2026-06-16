import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { buttonSecondary } from "@/components/ui";

import { findValidInvite } from "./actions";
import { AcceptForm } from "./accept-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await findValidInvite(token);

  return (
    <main className="relative grid min-h-dvh place-items-center px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-title text-lg font-semibold tracking-tight">DSEC</div>
          <div className="text-sm text-muted">Exec Dashboard</div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          {invite ? (
            <>
              <h1 className="mb-1 text-sm font-medium">Accept your invite</h1>
              <p className="mb-5 text-xs text-muted">
                You have been invited as{" "}
                <span className="text-foreground">{invite.roleName}</span>. Set a password to
                finish.
              </p>
              <AcceptForm token={token} email={invite.email} />
            </>
          ) : (
            <div className="text-center">
              <h1 className="mb-2 text-sm font-medium">Invite not valid</h1>
              <p className="mb-5 text-xs text-muted">
                This invite has expired, been used, or been revoked. Ask an admin to send a
                new one.
              </p>
              <Link href="/signin" className={buttonSecondary}>
                Go to sign in
              </Link>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Internal tool · DSEC committee only
        </p>
      </div>
    </main>
  );
}
