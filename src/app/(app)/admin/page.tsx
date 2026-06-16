import Link from "next/link";

import { PageHeader, StatCard, buttonSecondary } from "@/components/ui";
import { getAdminCounts } from "@/lib/admin-queries";

export default async function AdminOverviewPage() {
  const counts = await getAdminCounts();

  return (
    <>
      <PageHeader
        title="Admin"
        description="Manage who can sign in and what they can see."
        action={
          <Link href="/admin/invites" className={buttonSecondary}>
            Invite someone
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Users" value={counts.users} hint={`${counts.activeUsers} active`} />
        <StatCard label="Roles" value={counts.roles} />
        <StatCard label="Pending invites" value={counts.pendingInvites} />
        <StatCard label="Committees" value={counts.committees} />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <AdminLink
          href="/admin/users"
          title="Users"
          body="Assign roles, activate or deactivate logins, reset passwords."
        />
        <AdminLink
          href="/admin/roles"
          title="Roles"
          body="Create roles and choose which modules each one can access."
        />
        <AdminLink
          href="/admin/invites"
          title="Invites"
          body="Invite people by email with a role; track and revoke invites."
        />
        <AdminLink
          href="/admin/committees"
          title="Committees"
          body="Edit the committees used across people, events, and tasks — name, colour, lead, and more."
        />
        <AdminLink
          href="/admin/links"
          title="Public links"
          body="Global social and contact links shown on the public website."
        />
      </div>
    </>
  );
}

function AdminLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-surface p-5 transition-colors hover:bg-elevated"
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs text-muted">{body}</div>
    </Link>
  );
}
