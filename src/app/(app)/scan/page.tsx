import { PageHeader, SectionCard } from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { canWrite } from "@/lib/rbac";
import { getScanPage, getScanTargets } from "@/lib/workspace-queries";

import { ScanList } from "./scan-list";
import { ScanPageForm } from "./scan-page-form";

export default async function ScanPage() {
  const me = await requireModule("scan");
  const writable = canWrite(me.modules, me.writeModules, "scan");
  const [page, targets] = await Promise.all([getScanPage(), getScanTargets()]);

  return (
    <>
      <PageHeader
        title="Scan Wall"
        description="The public QR wall (dsec.club/scan), built to go up on a screen at events: an editable heading plus up to four QR cards. Until you add cards, a sensible default set shows."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Scan Wall" }]}
      />

      <div className="space-y-6">
        <SectionCard title="Heading">
          <div className="px-5 py-5">
            <ScanPageForm page={page} canWrite={writable} />
          </div>
        </SectionCard>

        <SectionCard title={`QR cards · ${targets.length}`}>
          <div className="px-5 py-5">
            <ScanList targets={targets} canWrite={writable} />
          </div>
        </SectionCard>
      </div>
    </>
  );
}
