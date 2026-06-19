import { notFound } from "next/navigation";

import { UndoButton } from "@/components/undo-button";
import { Badge, PageHeader, SectionCard, buttonGhost } from "@/components/ui";
import { getRoles, getUserById } from "@/lib/admin-queries";
import { getCurrentUser } from "@/lib/dal";
import { cn } from "@/lib/format";

import { deleteUser, updateUser } from "../../actions";
import { ResetOnboardingButton } from "../../reset-onboarding";
import { UserForm } from "../../user-form";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = Number(id);
  if (Number.isNaN(userId)) notFound();

  const [user, allRoles, me] = await Promise.all([
    getUserById(userId),
    getRoles(),
    getCurrentUser(),
  ]);
  if (!user) notFound();
  const roles = allRoles.map((r) => ({
    id: r.id,
    name: r.name,
    modules: r.modules,
    writeModules: r.writeModules,
  }));

  const onboarded = !!user.onboardingCompletedAt;
  const isSelf = me?.id === userId;

  return (
    <>
      <PageHeader
        title="Edit user"
        description={user.email}
        action={
          isSelf ? undefined : (
            <UndoButton
              action={deleteUser.bind(null, userId)}
              confirm={`Delete ${user.name ?? user.email} permanently? This removes their dashboard access and saved views.`}
              redirectTo="/admin/users"
              className={cn(buttonGhost, "text-danger hover:text-danger")}
            >
              Delete user
            </UndoButton>
          )
        }
      />
      <UserForm
        action={updateUser.bind(null, userId)}
        user={user}
        roles={roles}
        isSelf={isSelf}
        redirectOnSuccess="/admin/users"
      />

      <div className="mt-8 max-w-2xl">
        <SectionCard title="Onboarding">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant={onboarded ? "success" : "neutral"}>
                {onboarded ? "Completed" : "Pending"}
              </Badge>
              <span className="text-muted">
                {onboarded
                  ? "This user has set up their profile."
                  : "This user will set up their profile on their next visit."}
              </span>
            </div>
            <ResetOnboardingButton userId={userId} completed={onboarded} />
          </div>
        </SectionCard>
      </div>
    </>
  );
}
