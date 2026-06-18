import { signOut } from "@/auth";
import { ConfirmButton } from "@/components/confirm-button";
import { Icons } from "@/components/icons";
import { allowedScopesFor } from "@/lib/api-tokens";
import { requireUser } from "@/lib/dal";

import { clearPreviewRole } from "../admin/preview/actions";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const items = [
    { href: "/settings/profile", label: "Profile" },
    { href: "/settings/appearance", label: "Appearance" },
    { href: "/settings/password", label: "Password" },
    // Only surface API & MCP for roles that can actually mint a token.
    ...(allowedScopesFor(user).length > 0
      ? [{ href: "/settings/api", label: "API & MCP" }]
      : []),
  ];

  async function handleSignOut() {
    "use server";
    await clearPreviewRole(); // never leave a preview cookie across sessions
    await signOut({ redirectTo: "/signin" });
  }

  return (
    <div className="flex flex-col gap-8 md:flex-row md:gap-10">
      <div className="space-y-2 md:w-48 md:shrink-0">
        <SettingsNav items={items} />
        <div className="px-1 pt-2">
          <ConfirmButton
            action={handleSignOut}
            confirm="Sign out of DSEC?"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-surface hover:text-danger"
          >
            <Icons.signout className="h-4 w-4 shrink-0" />
            Sign out
          </ConfirmButton>
        </div>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
