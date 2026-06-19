import { notFound } from "next/navigation";

import { FormError } from "@/components/form";
import { UndoButton } from "@/components/undo-button";
import { PageHeader, buttonGhost, buttonSecondary } from "@/components/ui";
import { getRoleById } from "@/lib/admin-queries";
import { cn } from "@/lib/format";
import { isAdmin } from "@/lib/rbac";

import { setPreviewRole } from "../../../preview/actions";
import { deleteRole, updateRole } from "../../actions";
import { RoleForm } from "../../role-form";

const ERRORS: Record<string, string> = {
  system: "System roles can't be deleted.",
  inuse: "Reassign the users on this role before deleting it.",
};

export default async function EditRolePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const roleId = Number(id);
  if (Number.isNaN(roleId)) notFound();

  const role = await getRoleById(roleId);
  if (!role) notFound();

  const canDelete = !role.isSystem && role.userCount === 0;
  // The admin role can't be previewed (no narrowing → no point). Everything else
  // can: previewing overlays this role's narrowed view onto your own session and
  // drops you into the dashboard as that role. Exit via the banner up top.
  const canPreview = !isAdmin(role.modules);

  return (
    <>
      <PageHeader
        title="Edit role"
        description={role.name}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Roles", href: "/admin/roles" },
          { label: role.name ?? "Edit" },
        ]}
        action={
          canPreview || canDelete ? (
            <div className="flex items-center gap-2">
              {canPreview && (
                <form action={setPreviewRole.bind(null, roleId)}>
                  <button
                    type="submit"
                    className={buttonSecondary}
                    title="See the workspace as this role — narrowed nav, dashboard and landing page. Writes are disabled; this never changes your own access."
                  >
                    Preview as this role
                  </button>
                </form>
              )}
              {canDelete && (
                <UndoButton
                  action={deleteRole.bind(null, roleId)}
                  confirm="Delete this role permanently?"
                  redirectTo="/admin/roles"
                  className={cn(buttonGhost, "text-danger hover:text-danger")}
                >
                  Delete
                </UndoButton>
              )}
            </div>
          ) : undefined
        }
      />
      {error && (
        <div className="mb-5 max-w-2xl">
          <FormError>{ERRORS[error] ?? "Something went wrong."}</FormError>
        </div>
      )}
      <RoleForm
        action={updateRole.bind(null, roleId)}
        role={role}
        redirectOnSuccess="/admin/roles"
      />
    </>
  );
}
