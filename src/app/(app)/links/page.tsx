import { PageHeader, SectionCard } from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { canWrite } from "@/lib/rbac";
import { getLinkProfile, getLinks } from "@/lib/workspace-queries";

import { LinksList } from "./links-list";
import { ProfileForm } from "./profile-form";

export default async function LinksPage() {
  const me = await requireModule("links");
  const writable = canWrite(me.modules, me.writeModules, "links");
  const [links, profile] = await Promise.all([getLinks(), getLinkProfile()]);

  return (
    <>
      <PageHeader
        title="Link Tree"
        description="The public link page (dsec.club/links) — your profile header and an ordered stack of buttons."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Link Tree" }]}
      />

      <div className="space-y-6">
        <SectionCard title="Profile header">
          <div className="px-5 py-5">
            <ProfileForm profile={profile} canWrite={writable} />
          </div>
        </SectionCard>

        <SectionCard title={`Links · ${links.length}`}>
          <div className="px-5 py-5">
            <LinksList links={links} canWrite={writable} />
          </div>
        </SectionCard>
      </div>
    </>
  );
}
