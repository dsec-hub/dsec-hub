import { PageHeader } from "@/components/ui";
import { requireWrite } from "@/lib/dal";
import {
  getEventOptions,
  getMeetingOptions,
  getPersonOptions,
  getProjectOptions,
} from "@/lib/workspace-queries";

import { createDocument } from "../actions";
import { DocumentForm } from "../document-form";

export default async function NewDocumentPage() {
  await requireWrite("documents");

  const [people, events, projects, meetings] = await Promise.all([
    getPersonOptions(),
    getEventOptions(),
    getProjectOptions(),
    getMeetingOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="New doc"
        description="Write in Markdown — the preview updates as you type."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Docs", href: "/docs" },
          { label: "New" },
        ]}
      />
      <DocumentForm
        action={createDocument}
        people={people}
        events={events}
        projects={projects}
        meetings={meetings}
      />
    </>
  );
}
