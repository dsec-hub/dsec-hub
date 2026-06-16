import Link from "next/link";

import { Badge, EmptyState, PageHeader, SectionCard, buttonPrimary } from "@/components/ui";
import { getUsers } from "@/lib/admin-queries";
import { isAdmin } from "@/lib/rbac";

export default async function UsersPage() {
  const users = await getUsers();

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone who can sign in to the dashboard."
        action={
          <Link href="/admin/invites" className={buttonPrimary}>
            Invite someone
          </Link>
        }
      />

      {users.length === 0 ? (
        <SectionCard title="Users">
          <EmptyState>No users yet.</EmptyState>
        </SectionCard>
      ) : (
        <SectionCard title={`Users · ${users.length}`}>
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li key={u.id}>
                <Link
                  href={`/admin/users/${u.id}/edit`}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-elevated/50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{u.name ?? u.email}</div>
                    <div className="truncate text-xs text-muted">{u.email}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isAdmin(u.roleModules) && <Badge variant="accent">Admin</Badge>}
                    {!u.onboardingCompletedAt && <Badge variant="warning">Onboarding</Badge>}
                    <Badge variant="neutral">{u.roleName ?? "No role"}</Badge>
                    <Badge variant={u.isActive ? "success" : "danger"}>
                      {u.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </>
  );
}
