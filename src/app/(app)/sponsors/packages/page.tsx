import Link from "next/link";

import { getSponsorPackages } from "@/lib/queries";
import { requireModule } from "@/lib/dal";
import { canWrite } from "@/lib/rbac";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui";

import { PackageManager } from "./package-manager";

export default async function PackagesPage() {
  const me = await requireModule("sponsors");
  const writable = canWrite(me.modules, me.writeModules, "sponsors");
  const packages = await getSponsorPackages();

  return (
    <>
      <PageHeader
        title="Sponsorship Packages"
        description="Tier definitions shown on the public website"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sponsors", href: "/sponsors" },
          { label: "Packages" },
        ]}
      />

      <div className="mb-4 flex gap-3 border-b border-border pb-4">
        <Link href="/sponsors" className="text-sm text-muted transition-colors hover:text-foreground">
          Pipeline
        </Link>
        <Link href="/sponsors/packages" className="text-sm font-medium text-foreground">
          Packages
        </Link>
        <Link href="/sponsors/leads" className="text-sm text-muted transition-colors hover:text-foreground">
          Leads
        </Link>
      </div>

      <SectionCard
        title={`Packages · ${packages.length}`}
        action={<PackageManager packages={packages} mode="new" canWrite={writable} />}
      >
        {packages.length === 0 ? (
          <EmptyState>
            No packages yet. Add your first tier — it will appear on the public sponsor
            page once marked visible.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {packages.map((pkg) => (
              <li key={pkg.id} className="flex items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{pkg.name}</span>
                    {pkg.featured && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-text">
                        featured
                      </span>
                    )}
                    {!pkg.isVisible && (
                      <span className="rounded-full bg-elevated px-2 py-0.5 text-xs text-muted">
                        hidden
                      </span>
                    )}
                  </div>
                  {pkg.pitch && (
                    <p className="mt-0.5 truncate text-xs text-muted">{pkg.pitch}</p>
                  )}
                  {pkg.price && (
                    <p className="mt-0.5 text-xs text-muted">
                      Price: <span className="font-medium text-foreground">{pkg.price}</span>
                    </p>
                  )}
                  {pkg.includes && pkg.includes.length > 0 && (
                    <p className="mt-0.5 text-xs text-muted">
                      {pkg.includes.length} item{pkg.includes.length !== 1 ? "s" : ""} included
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs tabular-nums text-muted">#{pkg.displayOrder}</span>
                  <PackageManager packages={packages} mode="edit" pkg={pkg} canWrite={writable} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
