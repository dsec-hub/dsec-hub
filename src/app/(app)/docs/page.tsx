import Link from "next/link";

import { ViewTabs } from "@/components/dashboard";
import { Badge, EmptyState, PageHeader, SectionCard, buttonPrimary } from "@/components/ui";
import type { BadgeVariant } from "@/lib/options";
import { requireModule } from "@/lib/dal";
import { committeeScopeOf } from "@/lib/scope";
import { formatDate } from "@/lib/format";
import { canWrite } from "@/lib/rbac";
import { getDocuments } from "@/lib/workspace-queries";

const DOC_TYPES = [
  "All",
  "Page",
  "Note",
  "MeetingNotes",
  "SponsorDoc",
  "Deliverable",
  "Policy",
  "General",
] as const;

type DocType = (typeof DOC_TYPES)[number];

const TYPE_LABELS: Record<DocType, string> = {
  All: "All",
  Page: "Pages",
  Note: "Notes",
  MeetingNotes: "Meeting Notes",
  SponsorDoc: "Sponsor Docs",
  Deliverable: "Deliverables",
  Policy: "Policies",
  General: "General",
};

function statusVariant(status: string | null | undefined): BadgeVariant {
  switch (status) {
    case "Published":
    case "Final":
    case "Approved":
    case "Done":
      return "success";
    case "In Review":
    case "Review":
    case "Pending":
      return "warning";
    case "Blocked":
      return "danger";
    case "Draft":
      return "accent";
    default:
      return "neutral";
  }
}

export default async function DocsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const me = await requireModule("documents");
  const writable = canWrite(me.modules, me.writeModules, "documents");
  const { type: rawType } = await searchParams;
  const active: DocType = DOC_TYPES.includes(rawType as DocType)
    ? (rawType as DocType)
    : "All";

  const docs = await getDocuments(committeeScopeOf(me), active === "All" ? {} : { type: active });

  const tabs = DOC_TYPES.map((t) => ({
    key: t,
    label: TYPE_LABELS[t],
    href: t === "All" ? "/docs" : `/docs?type=${t}`,
  }));

  return (
    <>
      <PageHeader
        title="Docs"
        description="Notion-style documents — notes, meeting minutes, sponsor packs, and deliverables."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Docs" }]}
        action={
          writable ? (
            <Link href="/docs/new" className={buttonPrimary}>
              New doc
            </Link>
          ) : undefined
        }
      />

      <ViewTabs tabs={tabs} active={active} />

      <SectionCard title={`${docs.length} document${docs.length === 1 ? "" : "s"}`}>
        {docs.length === 0 ? (
          <EmptyState>
            {active === "All"
              ? "No documents yet."
              : `No ${TYPE_LABELS[active].toLowerCase()} yet.`}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {docs.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/docs/${d.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-elevated"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{d.title}</div>
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {d.type === "Deliverable" && d.assigneeName
                        ? `for ${d.assigneeName} · `
                        : ""}
                      {d.type === "Page" && d.slug ? (
                        <span className="text-muted/80">/{d.slug} · </span>
                      ) : (
                        ""
                      )}
                      {formatDate(d.updatedAt)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {d.committee && <Badge variant="accent">{d.committee}</Badge>}
                    {d.type === "Page" && (
                      <Badge variant={d.isPublic ? "success" : "warning"}>
                        {d.isPublic ? "Published" : "Draft"}
                      </Badge>
                    )}
                    <Badge variant="neutral">{d.type ?? "—"}</Badge>
                    <Badge variant={statusVariant(d.status)}>{d.status ?? "—"}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
