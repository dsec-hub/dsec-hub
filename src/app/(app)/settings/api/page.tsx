import { Badge, buttonGhost, EmptyState, PageHeader, SectionCard } from "@/components/ui";
import { Icons } from "@/components/icons";
import { apiEnv } from "@/lib/api-env";
import {
  allowedScopesFor,
  API_SCOPES,
  listTokensForUser,
  mcpServerUrl,
} from "@/lib/api-tokens";
import { requireUser } from "@/lib/dal";
import { cn, formatDate } from "@/lib/format";

import { revokeApiToken } from "./actions";
import { CreateTokenForm, McpConnection } from "./api-tokens-client";

export default async function ApiSettingsPage() {
  const user = await requireUser();
  const allowed = allowedScopesFor(user);
  const allowedOptions = API_SCOPES.filter((s) => allowed.includes(s.key));
  const tokens = await listTokensForUser(user.id);
  const configured = apiEnv() !== null;

  return (
    <>
      <PageHeader
        title="API & MCP"
        description="Personal tokens to connect the DSEC workspace to Claude, ChatGPT, or any MCP client."
        breadcrumbs={[{ label: "Settings", href: "/settings" }, { label: "API & MCP" }]}
      />

      <div className="max-w-2xl space-y-6">
        {!configured && (
          <div className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
            API tokens are unavailable — the server is missing <code>DSEC_API_URL</code> /{" "}
            <code>DSEC_API_KEY</code>. Ask an admin to configure them.
          </div>
        )}

        <SectionCard title="Create a token">
          <div className="space-y-4 px-5 py-4">
            <p className="text-xs text-muted">
              Tokens carry coarse, global access: a read token can read every module, a write token
              can write every module via MCP. Only mint tokens for yourself and keep them secret.
            </p>
            {allowedOptions.length === 0 ? (
              <p className="text-sm text-muted">
                Your role doesn’t permit creating API tokens. Ask an admin if you need one.
              </p>
            ) : (
              <CreateTokenForm scopes={allowedOptions} disabled={!configured} />
            )}
          </div>
        </SectionCard>

        <SectionCard title="Your tokens">
          {tokens.length === 0 ? (
            <EmptyState>No tokens yet — create one above to get started.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {tokens.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{t.name}</span>
                      {t.revoked && <Badge variant="danger">Revoked</Badge>}
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-muted">{t.prefix}…</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      {t.scopes.map((s) => (
                        <Badge key={s} variant="neutral">
                          {s}
                        </Badge>
                      ))}
                      <span className="text-muted/70">
                        · created {formatDate(t.createdAt)}
                        {t.lastUsedAt ? ` · last used ${formatDate(t.lastUsedAt)}` : " · never used"}
                      </span>
                    </p>
                  </div>
                  {!t.revoked && (
                    <div className="flex items-center gap-1">
                      <a
                        href={`/settings/api/llm-guide?scopes=${encodeURIComponent(
                          t.scopes.join(","),
                        )}&label=${encodeURIComponent(t.name)}`}
                        download="llm.md"
                        className={cn(buttonGhost, "gap-1.5")}
                        title="Download the AI-assistant guide for this token's scopes"
                      >
                        <Icons.documents className="h-4 w-4" />
                        Guide
                      </a>
                      <form action={revokeApiToken.bind(null, t.id)}>
                        <button
                          type="submit"
                          className={cn(buttonGhost, "text-danger hover:text-danger")}
                        >
                          Revoke
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Connect a client">
          <div className="space-y-3 px-5 py-4">
            <p className="text-xs text-muted">
              Add the server to Claude (Desktop / Code) or any MCP-capable assistant, with your
              token as a bearer header.
            </p>
            <McpConnection url={mcpServerUrl()} allowedScopes={allowed} />
          </div>
        </SectionCard>
      </div>
    </>
  );
}
