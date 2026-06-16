import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/dal";

import { PasswordForm } from "../password-form";

export default async function PasswordSettingsPage() {
  await requireUser();
  return (
    <>
      <PageHeader
        title="Password"
        description="Update the password you use to sign in."
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Password" }]}
      />
      <div className="max-w-2xl">
        <PasswordForm />
      </div>
    </>
  );
}
