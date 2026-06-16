import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/dal";
import { buildThemeCss } from "@/lib/theme";

/**
 * First-run setup shell — a focused, sidebar-less layout outside the `(app)`
 * route group (so the forced redirect there can't loop back here). Requires an
 * authenticated, active user; anyone who has already finished onboarding is sent
 * straight into the app.
 */
export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) redirect("/signin");
  if (user.onboardingCompletedAt) redirect("/dashboard");

  const themeCss = buildThemeCss({
    themeAccent: user.themeAccent,
    themeBackground: user.themeBackground,
    themeFontTitle: user.themeFontTitle,
    themeFontBody: user.themeFontBody,
    themeWeightTitle: user.themeWeightTitle,
    themeWeightBody: user.themeWeightBody,
  });

  return (
    <>
      {themeCss ? <style>{themeCss}</style> : null}
      <main className="min-h-dvh bg-background px-4 py-10 sm:py-16">
        <div className="mx-auto w-full max-w-xl">{children}</div>
      </main>
    </>
  );
}
