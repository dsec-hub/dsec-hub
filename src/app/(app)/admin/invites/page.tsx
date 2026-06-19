import {
  Badge,
  EmptyState,
  PageHeader,
  SectionCard,
  buttonGhost,
} from "@/components/ui";
import { getInvites, getRoleOptions } from "@/lib/admin-queries";
import { getCommitteeOptions } from "@/lib/committee-queries";
import { cn, formatDate } from "@/lib/format";
import type { BadgeVariant } from "@/lib/options";

import { revokeInvite } from "./actions";
import { InviteForm } from "./invite-form";

function statusVariant(status: string, expired: boolean): BadgeVariant {
  if (status === "accepted") return "success";
  if (status === "revoked") return "neutral";
  if (expired) return "danger";
  return "warning"; // pending
}

export default async function InvitesPage() {
  const [invites, roles, committees] = await Promise.all([
    getInvites(),
    getRoleOptions(),
    getCommitteeOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Invites"
        description="Invite people by email and assign them a role."
      />

      <SectionCard title="New invite" className="mb-6">
        <div className="p-5">
          <InviteForm roles={roles} committees={committees} />
        </div>
      </SectionCard>

      {invites.length === 0 ? (
        <SectionCard title="Sent invites">
          <EmptyState>No invites sent yet.</EmptyState>
        </SectionCard>
      ) : (
        <SectionCard title={`Sent invites · ${invites.length}`}>
          <ul className="divide-y divide-border">
            {invites.map((inv) => {
              const expired = inv.status === "pending" && inv.expired;
              const label = expired ? "Expired" : inv.status;
              return (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-4 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {inv.name ? `${inv.name} · ${inv.email}` : inv.email}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {inv.roleName ?? "—"}
                      {inv.roleTitle ? ` · ${inv.roleTitle}` : ""}
                      {inv.committee ? ` · ${inv.committee}` : ""} · invited{" "}
                      {formatDate(inv.createdAt)}
                      {inv.status === "pending" && !expired
                        ? ` · expires ${formatDate(inv.expiresAt)}`
                        : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant={statusVariant(inv.status, expired)}>
                      {label[0].toUpperCase() + label.slice(1)}
                    </Badge>
                    {inv.status === "pending" && !expired && (
                      <form action={revokeInvite.bind(null, inv.id)}>
                        <button className={cn(buttonGhost, "text-danger hover:text-danger")}>
                          Revoke
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}
    </>
  );
}
