import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/dal";

import { AppearanceForm } from "./appearance-form";

export default async function AppearanceSettingsPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader
        title="Appearance"
        description="Personalise the theme, colours, fonts and weight. Saved to your account only."
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "Appearance" }]}
      />
      <AppearanceForm
        initialAccent={user.themeAccent}
        initialBackground={user.themeBackground}
        initialFontTitle={user.themeFontTitle}
        initialFontBody={user.themeFontBody}
        initialWeightTitle={user.themeWeightTitle}
        initialWeightBody={user.themeWeightBody}
      />
    </>
  );
}
