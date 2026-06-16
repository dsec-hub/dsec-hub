import Link from "next/link";

import { CommitteeDot } from "@/components/committee-select";
import { Badge, EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { getCommittees } from "@/lib/committee-queries";
import { getPeopleOptions } from "@/lib/queries";

import { NewCommitteeButton } from "./new-committee-button";

export default async function CommitteesPage() {
  const [committees, people] = await Promise.all([getCommittees(), getPeopleOptions()]);

  return (
    <>
      <PageHeader
        title="Committees"
        description="The club's committees and their properties — used across people, events, and tasks."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Committees" }]}
        action={<NewCommitteeButton people={people} />}
      />

      {committees.length === 0 ? (
        <SectionCard title="Committees">
          <EmptyState>
            No committees yet — run{" "}
            <code className="text-foreground">scripts/create-committee-table.ts</code> to seed them.
          </EmptyState>
        </SectionCard>
      ) : (
        <SectionCard title={`Committees · ${committees.length}`}>
          <ul className="divide-y divide-border">
            {committees.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/committees/${c.id}/edit`}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-elevated/50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CommitteeDot color={c.color} />
                      <span className="truncate text-sm font-medium">{c.name}</span>
                      {!c.isActive && <Badge variant="neutral">Inactive</Badge>}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {c.leadName ? `Lead: ${c.leadName}` : "No lead"}
                      {c.description ? ` · ${c.description}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-muted">
                    {c.peopleCount} {c.peopleCount === 1 ? "person" : "people"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </>
  );
}
