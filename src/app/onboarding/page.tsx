import { requireUser } from "@/lib/dal";
import { ensurePersonForUser } from "@/lib/person-link";
import { getPersonById } from "@/lib/queries";
import { getMedia } from "@/lib/workspace-queries";

import { OnboardingWizard } from "./wizard";

export default async function OnboardingPage() {
  const user = await requireUser();
  // Make sure a roster record exists/links, then prefill the wizard from it
  // (re-runs keep whatever they entered last time).
  const personId = await ensurePersonForUser(user);
  const person = await getPersonById(personId);
  const photos = await getMedia("person", personId);

  return (
    <OnboardingWizard
      email={user.email}
      firstName={(person?.name ?? user.name ?? "").split(" ")[0] || null}
      initial={{
        name: person?.name ?? user.name ?? "",
        bio: person?.bio ?? "",
        studentId: person?.studentId ?? "",
        website: person?.website ?? "",
        discord: person?.discord ?? "",
        instagram: person?.instagram ?? "",
        github: person?.github ?? "",
        linkedin: person?.linkedin ?? "",
      }}
      initialPhotoUrl={photos[0]?.webpUrl ?? null}
    />
  );
}
