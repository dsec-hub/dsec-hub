import { notFound } from "next/navigation";

import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader, buttonGhost } from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { committeeScopeOf } from "@/lib/scope";
import { getCommitteeOptions } from "@/lib/committee-queries";
import { cn } from "@/lib/format";
import { parsePageDoc } from "@/lib/page-blocks";
import { pagePreviewUrl, pageSiteUrl } from "@/lib/page-links";
import { canWrite } from "@/lib/rbac";
import {
  getDocumentById,
  getEventOptions,
  getMeetingOptions,
  getPersonOptions,
  getProjectOptions,
  getTaskOptions,
} from "@/lib/workspace-queries";

import {
  archiveDocument,
  deleteDocument,
  setDocumentPublished,
  updateDocument,
  uploadPageImage,
} from "../../actions";
import { DocumentForm } from "../../document-form";
import { PagePublishPanel } from "../../page-publish-panel";

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

  const scope = committeeScopeOf(me);
  const [document, people, events, projects, meetings, tasks, committeeOpts] = await Promise.all([
    getDocumentById(documentId, scope),
    getPersonOptions(),
    getEventOptions(),
    getProjectOptions(),
    getMeetingOptions(scope),
    getTaskOptions(),
    getCommitteeOptions(),
  ]);
  if (!document) notFound();

  // Page-type docs gain a "Publish as page" panel (slug/nav/SEO/cover/blocks +
  // the Publish toggle). Built server-side so the live/preview links resolve.
  let pageSection: React.ReactNode = undefined;
  if (document.type === "Page") {
    const blocks = parsePageDoc(document.contentJson).blocks;
    const [previewUrl, siteUrl] = await Promise.all([
      pagePreviewUrl(documentId),
      Promise.resolve(pageSiteUrl(document.slug)),
    ]);
    pageSection = (
      <PagePublishPanel
        docId={documentId}
        canWrite={writable}
        published={document.isPublic}
        slug={document.slug}
        navLabel={document.navLabel}
        showInNav={document.showInNav}
        navArea={document.navArea}
        navOrder={document.navOrder}
        seoDescription={document.seoDescription}
        coverImageUrl={document.coverImageUrl}
        blocks={blocks}
        publishAction={setDocumentPublished.bind(null, documentId)}
        uploadAction={uploadPageImage}
        previewUrl={previewUrl}
        siteUrl={siteUrl}
        websiteOrigin={process.env.DSEC_WEBSITE_URL ?? null}
      />
    );
  }

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
        tasks={tasks}
        committees={committeeOpts.map((c) => c.name)}
        canChooseCommittee={scope.all}
        lockedCommittee={me.userCommittee}
        canWrite={writable}
        pageSection={pageSection}
      />
    </>
  );
}
