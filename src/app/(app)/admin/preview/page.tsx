import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Badge, PageHeader, buttonPrimary, buttonSecondary } from "@/components/ui";
import { getRoles } from "@/lib/admin-queries";
import { getRealUser } from "@/lib/dal";
import { isAdmin } from "@/lib/rbac";
import { PREVIEW_COOKIE, verifyPreview } from "@/lib/role-preview";

import { clearPreviewRole, setPreviewRole } from "./actions";

export default async function PreviewRolePage() {
  // Gate on the REAL admin so an admin mid-preview can still reach this page.
  const real = await getRealUser();
  if (!real || !isAdmin(real.modules)) redirect("/dashboard");

  const roles = (await getRoles()).filter((r) => !isAdmin(r.modules));
  const currentRoleId = verifyPreview((await cookies()).get(PREVIEW_COOKIE)?.value);
  const currentName = roles.find((r) => r.id === currentRoleId)?.name;

  return (
    <>
      <PageHeader
        title="Preview as role"
        description="See the workspace exactly as another role sees it — the same narrowed navigation, dashboard sections, and landing page. Writes are disabled while previewing, and this never changes your own access."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Preview as role" }]}
      />

      <div className="space-y-6">
        {currentRoleId != null && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
            <p className="text-sm">
              Currently previewing <strong className="font-medium">{currentName ?? "a role"}</strong>.
            </p>
            <form action={clearPreviewRole}>
              <button type="submit" className={buttonSecondary}>
                Exit preview
              </button>
            </form>
          </div>
        )}

        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {roles.map((r) => {
            const active = r.id === currentRoleId;
            return (
              <div key={r.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{r.name}</span>
                    {active && <Badge variant="warning">Previewing</Badge>}
                    <span className="text-xs text-muted">
                      {r.userCount} {r.userCount === 1 ? "member" : "members"}
                    </span>
                  </div>
                  {r.description && <p className="mt-0.5 truncate text-xs text-muted">{r.description}</p>}
                </div>
                <form action={setPreviewRole.bind(null, r.id)}>
                  <button type="submit" className={active ? buttonSecondary : buttonPrimary} disabled={active}>
                    {active ? "Active" : "Preview"}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
