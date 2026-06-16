"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CheckboxField, Field, FormError, TextInput } from "@/components/form";
import { Icons } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { buttonGhost } from "@/components/ui";
import { cn } from "@/lib/format";
import type { ApiScope } from "@/lib/api-tokens";
import { useActionToast } from "@/lib/use-action-toast";

import { createApiToken } from "./actions";

type ScopeOption = { key: ApiScope; label: string; description: string };

/** Copy-to-clipboard button (raw key + connection snippet). */
function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy to clipboard.");
        }
      }}
      className={cn(buttonGhost, "gap-1.5")}
    >
      {copied ? <Icons.check className="h-4 w-4" /> : <Icons.copy className="h-4 w-4" />}
      {copied ? "Copied" : label}
    </button>
  );
}

/** Build the same-origin download URL for the AI-assistant guide. */
function guideHref(scopes: string[], label?: string): string {
  const params = new URLSearchParams({ scopes: scopes.join(",") });
  if (label) params.set("label", label);
  return `/settings/api/llm-guide?${params.toString()}`;
}

/**
 * Download or copy the `llm.md` guide for a set of scopes. The guide teaches an
 * AI assistant (Claude, ChatGPT, Codex, Claude Code) how to drive the DSEC MCP
 * with exactly the tools those scopes allow. Generated server-side from the live
 * tool catalogue and contains no secret.
 */
export function GuideActions({
  scopes,
  label,
  compact = false,
}: {
  scopes: string[];
  label?: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  if (scopes.length === 0) return null;
  const href = guideHref(scopes, label);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={href} download="llm.md" className={cn(buttonGhost, "gap-1.5")}>
        <Icons.documents className="h-4 w-4" />
        {compact ? "Guide" : "Download llm.md"}
      </a>
      {!compact && (
        <button
          type="button"
          onClick={async () => {
            try {
              const res = await fetch(href, { cache: "no-store" });
              if (!res.ok) throw new Error();
              await navigator.clipboard.writeText(await res.text());
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              toast.error("Couldn't copy the guide.");
            }
          }}
          className={cn(buttonGhost, "gap-1.5")}
        >
          {copied ? <Icons.check className="h-4 w-4" /> : <Icons.copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy guide"}
        </button>
      )}
    </div>
  );
}

/** The one-and-only reveal of a freshly minted key. */
function RevealedKey({
  rawKey,
  scopes,
  mcpUrl,
}: {
  rawKey: string;
  scopes: string[];
  mcpUrl: string;
}) {
  // Claude.ai's "Add custom connector" dialog accepts only a URL — no header
  // field — so the key has to ride in the link. The MCP server reads `?key=`.
  const connectUrl = `${mcpUrl}?key=${encodeURIComponent(rawKey)}`;
  return (
    <div className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Your new token</p>
        <CopyButton value={rawKey} />
      </div>
      <code className="block break-all rounded-md bg-background px-3 py-2 font-mono text-xs">
        {rawKey}
      </code>
      <p className="text-xs text-danger">
        Copy it now — for security it’s shown only once and can’t be retrieved again.
      </p>
      <div className="space-y-1.5 border-t border-accent/20 pt-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Paste-into-Claude link</p>
          <CopyButton value={connectUrl} label="Copy link" />
        </div>
        <code className="block break-all rounded-md bg-background px-3 py-2 font-mono text-xs">
          {connectUrl}
        </code>
        <p className="text-xs text-muted">
          In Claude → <span className="font-medium">Settings → Connectors → Add custom connector</span>,
          paste this as the <span className="font-medium">Remote MCP server URL</span>. Your key is
          baked into the link, so treat the whole URL as a secret.
        </p>
      </div>
      <div className="space-y-1.5 border-t border-accent/20 pt-3">
        <p className="text-xs text-muted">
          Hand this guide to Claude, ChatGPT, Codex or Claude Code so it knows how to use the
          workspace with this token’s scopes ({scopes.join(", ")}). Paste your key into its MCP
          config — the guide keeps the key as a placeholder.
        </p>
        <GuideActions scopes={scopes} label="your new token" />
      </div>
    </div>
  );
}

export function CreateTokenForm({
  scopes,
  disabled,
  mcpUrl,
}: {
  scopes: ScopeOption[];
  disabled?: boolean;
  mcpUrl: string;
}) {
  const [state, formAction] = useActionState(createApiToken, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useActionToast(state);

  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      toast.success("Token created.");
      formRef.current?.reset();
    }
  }, [state]);

  const minted = state && "ok" in state && state.ok ? state : null;

  return (
    <div className="space-y-4">
      {minted && <RevealedKey rawKey={minted.rawKey} scopes={minted.scopes} mcpUrl={mcpUrl} />}
      <form ref={formRef} action={formAction} className="space-y-5">
        <FormError>{state && "error" in state ? state.error : undefined}</FormError>
        <Field label="Token name" hint="e.g. “Claude desktop” or “my laptop”.">
          <TextInput name="name" required maxLength={120} disabled={disabled} />
        </Field>
        <fieldset className="space-y-3 rounded-xl border border-border p-4" disabled={disabled}>
          <legend className="px-1 text-xs text-muted">Scopes</legend>
          {scopes.map((s, i) => (
            <div key={s.key} className="space-y-0.5">
              <CheckboxField label={s.label} name={`scope_${s.key}`} defaultChecked={i === 0} />
              <p className="pl-[1.625rem] text-xs text-muted/70">{s.description}</p>
            </div>
          ))}
        </fieldset>
        <SubmitButton>Create token</SubmitButton>
      </form>
    </div>
  );
}

/** A copyable MCP connection snippet for chat clients, plus a role-wide guide. */
export function McpConnection({ url, allowedScopes }: { url: string; allowedScopes: string[] }) {
  const snippet = JSON.stringify(
    {
      mcpServers: {
        dsec: { type: "http", url, headers: { Authorization: "Bearer dsec_live_YOUR_KEY" } },
      },
    },
    null,
    2,
  );
  return (
    <div className="space-y-3">
      <div className="space-y-1.5 rounded-xl border border-accent/40 bg-accent/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Easiest: connect with your DSEC login (no token)</p>
          <CopyButton value={url} label="Copy URL" />
        </div>
        <code className="block break-all rounded-md bg-background px-3 py-2 font-mono text-xs">
          {url}
        </code>
        <p className="text-xs text-muted">
          In Claude → <span className="font-medium">Settings → Connectors → Add custom connector</span>,
          paste just this URL and click Add. Claude opens a DSEC sign-in page; log in with your
          dashboard account and approve. No token to mint or paste — access is bounded by your role
          and you can revoke it from your account at any time.
        </p>
      </div>

      <p className="text-xs text-muted pt-1">
        Prefer a token (Claude Desktop / Code, ChatGPT, scripts)? Use the connection below.
      </p>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Server URL <code className="font-mono text-xs text-foreground">{url}</code> · transport
          Streamable HTTP · auth <code className="font-mono text-xs">Authorization: Bearer …</code>
        </p>
        <CopyButton value={snippet} label="Copy config" />
      </div>
      <pre className="overflow-x-auto rounded-md bg-background px-3 py-2 font-mono text-xs leading-relaxed">
        {snippet}
      </pre>
      <div className="space-y-1.5 border-t border-border pt-3">
        <p className="text-xs text-muted">
          Using Claude.ai’s <span className="font-medium">Add custom connector</span> dialog (no
          header field)? Skip the config above and paste the URL with your key on the end:
        </p>
        <code className="block break-all rounded-md bg-background px-3 py-2 font-mono text-xs">
          {url}?key=dsec_live_YOUR_KEY
        </code>
        <p className="text-xs text-muted/70">
          The exact link with your key baked in is shown once, right after you create a token above.
        </p>
      </div>
      {allowedScopes.length > 0 && (
        <div className="space-y-1.5 border-t border-border pt-3">
          <p className="text-xs text-muted">
            New to MCP? Download a ready-made <code className="font-mono">llm.md</code> guide for
            your assistant — it covers every tool your role can use and how to drive them.
          </p>
          <GuideActions scopes={allowedScopes} label="your DSEC role" />
        </div>
      )}
    </div>
  );
}
