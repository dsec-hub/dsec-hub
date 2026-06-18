import Link from "next/link";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/markdown";
import { Badge, EmptyState, PageHeader, SectionCard, buttonSecondary } from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { committeeScopeOf } from "@/lib/scope";
import { formatDate } from "@/lib/format";
import { canWrite } from "@/lib/rbac";
import { docStatusVariant } from "@/lib/workspace-options";
import { getDocumentById, getPersonOptions } from "@/lib/workspace-queries";

export default async function DocDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireModule("documents");
  const writable = canWrite(me.modules, me.writeModules, "documents");
  const { id } = await params;
  const did = Number(id);
  if (Number.isNaN(did)) notFound();
  const [doc, people] = await Promise.all([
    getDocumentById(did, committeeScopeOf(me)),
    getPersonOptions(),
  ]);
  if (!doc) notFound();
  const assignee = people.find((p) => p.id === doc.assigneeId)?.name;

  return (
    <>
      <PageHeader
        title={doc.title}
        description={
          [doc.type, doc.status, doc.updatedAt ? `updated ${formatDate(doc.updatedAt)}` : null]
            .filter(Boolean)
            .join(" · ")
        }
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Docs", href: "/docs" },
          { label: doc.title },
        ]}
        action={
          writable ? (
            <Link href={`/docs/${doc.id}/edit`} className={buttonSecondary}>
              Edit
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {doc.type && <Badge variant="neutral">{doc.type}</Badge>}
        <Badge variant={docStatusVariant(doc.status)}>{doc.status ?? "Draft"}</Badge>
        {doc.type === "Deliverable" && assignee && (
          <span className="text-xs text-muted">for {assignee}</span>
        )}
      </div>

      <SectionCard title="Document">
        <div className="p-5">
          {doc.content ? <Markdown content={doc.content} /> : <EmptyState>This document is empty.</EmptyState>}
        </div>
      </SectionCard>
    </>
  );
}
