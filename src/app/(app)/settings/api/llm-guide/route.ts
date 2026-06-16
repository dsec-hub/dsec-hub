import { getCurrentUser } from "@/lib/dal";
import { fetchLlmGuide, type ApiScope } from "@/lib/api-tokens";

const KNOWN_SCOPES: ApiScope[] = ["read", "write", "trigger", "ingest"];

/**
 * Download an `llm.md` — the AI-assistant guide for the DSEC MCP — tailored to a
 * set of scopes (a freshly minted key's scopes, an existing token's scopes, or
 * the user's whole role). The body is rendered by dsec-api from its tool
 * catalogue and contains no secret (the key is a placeholder), so this is just a
 * thin, signed-in proxy that adds the download headers.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const scopes = (url.searchParams.get("scopes") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ApiScope => (KNOWN_SCOPES as string[]).includes(s));
  if (scopes.length === 0) {
    return new Response("Pass at least one valid scope.", { status: 400 });
  }
  const label = url.searchParams.get("label") ?? undefined;

  const md = await fetchLlmGuide(scopes, label);
  if (md == null) {
    return new Response("Guide unavailable — the DSEC API isn't configured.", { status: 502 });
  }

  return new Response(md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="llm.md"',
      "Cache-Control": "no-store",
    },
  });
}
