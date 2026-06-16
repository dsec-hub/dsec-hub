import Link from "next/link";

import { Badge, EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { getRoles } from "@/lib/admin-queries";
import { MODULES } from "@/lib/rbac";

import { NewRoleButton } from "./new-role-button";

const LABEL: Record<string, string> = Object.fromEntries(MODULES.map((m) => [m.key, m.label]));

export default async function RolesPage() {
  const roles = await getRoles();

  return (
    <>
      <PageHeader
        title="Roles"
        description="Each role grants access to a set of modules."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Roles" }]}
        action={<NewRoleButton />}
      />

      {roles.length === 0 ? (
        <SectionCard title="Roles">
          <EmptyState>No roles yet.</EmptyState>
        </SectionCard>
      ) : (
        <SectionCard title={`Roles · ${roles.length}`}>
          <ul className="divide-y divide-border">
            {roles.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/roles/${r.id}/edit`}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-elevated/50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{r.name}</span>
                      {r.isSystem && <Badge variant="accent">System</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.modules.includes("admin") ? (
                        <Badge variant="success">Full access</Badge>
                      ) : r.modules.length === 0 ? (
                        <span className="text-xs text-muted">Overview only</span>
                      ) : (
                        r.modules.map((m) => {
                          const editable = r.writeModules.includes(m);
                          return (
                            <Badge key={m} variant={editable ? "accent" : "neutral"}>
                              {LABEL[m] ?? m}
                              {!editable && " · view"}
                            </Badge>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-muted">
                    {r.userCount} {r.userCount === 1 ? "user" : "users"}
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
