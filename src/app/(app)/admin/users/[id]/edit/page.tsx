import { notFound } from "next/navigation";

import { Badge, PageHeader, SectionCard } from "@/components/ui";
import { getRoles, getUserById } from "@/lib/admin-queries";
import { getCurrentUser } from "@/lib/dal";

import { updateUser } from "../../actions";
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

  return (
    <>
      <PageHeader title="Edit user" description={user.email} />
      <UserForm
        action={updateUser.bind(null, userId)}
        user={user}
        roles={roles}
        isSelf={me?.id === userId}
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
