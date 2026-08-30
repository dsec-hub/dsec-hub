"use client";

import { useState, useTransition } from "react";

import { controlBase } from "@/components/form";
import { Badge, buttonGhost, buttonPrimary } from "@/components/ui";
import { cn } from "@/lib/format";

import { linkAccountToMember, searchRosterMembers, type RosterCandidate } from "./actions";

/**
 * Link a manually-approved portal account to its DUSA roster record
 * (NEW-APPDEEP-01 Part B). Searches by name or student id, shows `is_current` on
 * each candidate, and warns before linking a not-current member (whose card the
 * door scanner rejects — NEW-APPDEEP-02).
 */
export function LinkRosterMember({ accountId }: { accountId: number }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RosterCandidate[]>([]);
  const [searching, startSearch] = useTransition();
  const [linking, startLink] = useTransition();

  function runSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    startSearch(async () => {
      setResults(await searchRosterMembers(q));
    });
  }

  function link(m: RosterCandidate) {
    if (
      !m.isCurrent &&
      !window.confirm(
        `${m.fullName ?? m.studentId} is NOT a current roster member. Their membership card will be rejected at the door until an import restores them. Link anyway?`,
      )
    ) {
      return;
    }
    startLink(async () => {
      await linkAccountToMember(accountId, m.id);
      setOpen(false);
      setQuery("");
      setResults([]);
    });
  }

  if (!open) {
    return (
      <button type="button" className={buttonGhost} onClick={() => setOpen(true)}>
        Link roster
      </button>
    );
  }

  return (
    <div className="w-full min-w-64 space-y-2 sm:w-72">
      <div className="flex items-center gap-2">
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="Search name or student ID…"
          className={cn(controlBase, "text-sm")}
        />
        <button
          type="button"
          className={buttonGhost}
          onClick={() => {
            setOpen(false);
            setQuery("");
            setResults([]);
          }}
        >
          Cancel
        </button>
      </div>

      {query.trim().length >= 2 && (
        <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-surface">
          {searching && results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted/70">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted/70">No roster match.</p>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 truncate text-sm">
                      {m.fullName ?? "(no name)"}
                      {m.isCurrent ? (
                        <Badge variant="success">current</Badge>
                      ) : (
                        <Badge variant="danger">not current</Badge>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {m.studentId}
                      {m.email ? ` · ${m.email}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={linking}
                    className={buttonPrimary}
                    onClick={() => link(m)}
                  >
                    Link
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
