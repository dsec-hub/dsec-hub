import Link from "next/link";

import { PageHeader } from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { DUSA_STATUSES } from "@/lib/options";
import { getDusaPipeline } from "@/lib/queries";
import { canWrite } from "@/lib/rbac";

import { DusaBoard } from "./dusa-board";

export default async function DusaPipelinePage() {
  const me = await requireModule("events");
  const writable = canWrite(me.modules, me.writeModules, "events");
  const all = await getDusaPipeline();
  const columns = DUSA_STATUSES.map((status) => ({
    status,
    items: all.filter((e) => (e.dusaSubmissionStatus ?? "Not Started") === status),
  }));

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Events", href: "/events" },
          { label: "DUSA pipeline" },
        ]}
        title="DUSA pipeline"
        description="Drag events between columns to update their submission status."
        action={
          <Link href="/events" className="text-sm text-muted hover:text-foreground">
            ← All events
          </Link>
        }
      />

      <DusaBoard columns={columns} canWrite={writable} />
    </>
  );
}
