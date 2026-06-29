import { PageHeader } from "@/components/ui";
import { requireWrite } from "@/lib/dal";
import { committeeScopeOf } from "@/lib/scope";
import { getCommitteeOptions } from "@/lib/committee-queries";
import {
  getEventOptions,
  getMeetingOptions,
  getPersonOptions,
  getProjectOptions,
  getTaskOptions,
} from "@/lib/workspace-queries";

import { createDocument } from "../actions";
import { DocumentForm } from "../document-form";

export default async function NewDocumentPage() {
  const me = await requireWrite("documents");
  const scope = committeeScopeOf(me);

  const [people, events, projects, meetings, tasks, committeeOpts] = await Promise.all([
    getPersonOptions(),
    getEventOptions(),
    getProjectOptions(),
    getMeetingOptions(scope),
    getTaskOptions(),
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
        tasks={tasks}
        committees={committeeOpts.map((c) => c.name)}
        canChooseCommittee={scope.all}
        lockedCommittee={me.userCommittee}
        pageSection={
          <p className="rounded-xl border border-dashed border-border bg-surface px-5 py-4 text-sm text-muted">
            Publishing as a page? Set the type to <strong className="text-foreground">Page</strong> and
            create the document first — then add content blocks, images, and the public URL on the edit
            screen. (Images need the saved page&rsquo;s id.)
          </p>
        }
      />
    </>
  );
}
