import Link from "next/link";

import { PageHeader, SectionCard, buttonPrimary } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { MODULES, canAccess } from "@/lib/rbac";

// Shown when a user navigates (or is redirected) to a module they can't access.
// Replaces the old silent bounce to "/" — names what they tried to open, what
// their role is, and where they CAN go, with a path to request more access.
export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await requireUser();
  const { from } = await searchParams;
  const attempted = MODULES.find((m) => m.key === from);
  const accessible = MODULES.filter((m) => m.key !== "admin" && canAccess(user.modules, m.key));

  return (
    <>
      <PageHeader
        title="No access to that area"
        description={
          attempted
            ? `Your role (${user.roleName ?? "member"}) can't open ${attempted.label}.`
            : `Your role (${user.roleName ?? "member"}) can't open that area.`
        }
      />
      <SectionCard title="What you can open">
        <div className="space-y-4 px-5 py-5">
          {accessible.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {accessible.map((m) => (
                <Link
                  key={m.key}
                  href={m.href}
                  className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-elevated"
                >
                  {m.label}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">
              You don&rsquo;t have any areas yet. Ask an admin to grant you access.
            </p>
          )}
          <div className="flex items-center gap-3 pt-1">
            <Link href="/dashboard" className={buttonPrimary}>
              Back to dashboard
            </Link>
            <span className="text-xs text-muted">
              Need {attempted?.label ?? "this"}? Ask a committee admin to update your role.
            </span>
          </div>
        </div>
      </SectionCard>
    </>
  );
}
