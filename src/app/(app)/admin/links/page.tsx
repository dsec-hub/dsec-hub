import { PageHeader } from "@/components/ui";
import { getSiteSettings } from "@/lib/queries";

import { SiteLinksForm } from "./site-links-form";

export default async function AdminLinksPage() {
  const siteLinks = await getSiteSettings();
  return (
    <>
      <PageHeader
        title="Public links"
        description="Global social and contact links for DSEC. Leave a field blank to hide that link."
      />
      <SiteLinksForm values={siteLinks} />
    </>
  );
}
