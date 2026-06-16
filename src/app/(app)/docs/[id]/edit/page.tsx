import { notFound } from "next/navigation";

import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader, buttonGhost } from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { cn } from "@/lib/format";
import { canWrite } from "@/lib/rbac";
import {
  getDocumentById,
  getEventOptions,
  getMeetingOptions,
  getPersonOptions,
  getProjectOptions,
} from "@/lib/workspace-queries";

import { archiveDocument, deleteDocument, updateDocument } from "../../actions";
import { DocumentForm } from "../../document-form";

export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireModule("documents");
  const writable = canWrite(me.modules, me.writeModules, "documents");
  const { id } = await params;
  const documentId = Number(id);
  if (Number.isNaN(documentId)) notFound();

  const [document, people, events, projects, meetings] = await Promise.all([
    getDocumentById(documentId),
    getPersonOptions(),
    getEventOptions(),
    getProjectOptions(),
    getMeetingOptions(),
  ]);
  if (!document) notFound();

  return (
    <>
      <PageHeader
        title="Edit doc"
        description={document.title}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Docs", href: "/docs" },
          { label: document.title },
        ]}
        action={
          writable ? (
            <div className="flex items-center gap-2">
              <form
                action={async () => {
                  "use server";
                  await archiveDocument(documentId);
                }}
              >
                <button className={buttonGhost}>Archive</button>
              </form>
              <ConfirmButton
                action={deleteDocument.bind(null, documentId)}
                confirm="Delete this document permanently? This cannot be undone."
                className={cn(buttonGhost, "text-danger hover:text-danger")}
              >
                Delete
              </ConfirmButton>
            </div>
          ) : undefined
        }
      />
      <DocumentForm
        action={updateDocument.bind(null, documentId)}
        document={document}
        people={people}
        events={events}
        projects={projects}
        meetings={meetings}
        canWrite={writable}
      />
    </>
  );
}
