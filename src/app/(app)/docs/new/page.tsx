import { PageHeader } from "@/components/ui";
import { requireWrite } from "@/lib/dal";
import { committeeScopeOf } from "@/lib/scope";
import { getCommitteeOptions } from "@/lib/committee-queries";
import {
  getEventOptions,
  getMeetingOptions,
  getPersonOptions,
  getProjectOptions,
} from "@/lib/workspace-queries";

import { createDocument } from "../actions";
import { DocumentForm } from "../document-form";

export default async function NewDocumentPage() {
  const me = await requireWrite("documents");
  const scope = committeeScopeOf(me);

  const [people, events, projects, meetings, committeeOpts] = await Promise.all([
    getPersonOptions(),
    getEventOptions(),
    getProjectOptions(),
    getMeetingOptions(scope),
    getCommitteeOptions(),
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
        committees={committeeOpts.map((c) => c.name)}
        canChooseCommittee={scope.all}
        lockedCommittee={me.userCommittee}
      />
    </>
  );
}
