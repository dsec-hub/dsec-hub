import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/dal";
import { isValidLandingPath } from "@/lib/rbac";

// The standalone "Overview" landing was merged into the Dashboard. `/` now sends
// each user to their role's Focus landing path (validated against their modules,
// so it can never point somewhere they lack access), falling back to /dashboard.
// This is a default bounce target, NOT a jail — users still navigate freely.
export default async function HomePage() {
  const user = await getCurrentUser();
  const landing = user?.viewConfig?.landingPath;
  if (user && landing && landing !== "/" && isValidLandingPath(user.modules, landing)) {
    redirect(landing);
  }
  redirect("/dashboard");
}
