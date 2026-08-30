import { csvResponse, toCSV } from "@/lib/csv";
import { getCurrentUser } from "@/lib/dal";
import { canAccess } from "@/lib/rbac";
import { logUsage } from "@/lib/usage";
import { getCurrentTransactions, getMembers, type MemberRow } from "@/lib/workspace-queries";

const today = () => new Date().toISOString().slice(0, 10);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  const user = await getCurrentUser();
  if (!user || !user.isActive) return new Response("Unauthorized", { status: 401 });

  if (kind === "members") {
    if (!canAccess(user.modules, "members")) return new Response("Forbidden", { status: 403 });
    // Page through the whole roster so the export is never silently truncated.
    // The hard stop guards against an accidental infinite loop over the DB —
    // no student club has 50k members, so throwing there surfaces a real bug.
    const PAGE = 500;
    const rows: MemberRow[] = [];
    for (let offset = 0; ; offset += PAGE) {
      if (offset > 50_000) throw new Error("members export exceeded 50k rows");
      const page = await getMembers({ currentOnly: true, limit: PAGE, offset });
      rows.push(...page);
      if (page.length < PAGE) break;
    }
    const csv = toCSV(
      ["Full Name", "Student ID", "Email", "Campus", "Faculty", "Membership Type", "DUSA Member", "First Subscription", "Last Paid", "End Date"],
      rows.map((m) => [
        m.fullName, m.studentId, m.email, m.campus, m.faculty, m.membershipType,
        m.dusaMember ? "Yes" : "No", m.firstSubscriptionDate, m.lastPaidDate, m.endDate,
      ]),
    );
    await logUsage({ actorId: user.id, actorLabel: user.email, action: "view", targetType: "export", detail: "members.csv" });
    return csvResponse(csv, `dsec-members-${today()}.csv`);
  }

  if (kind === "transactions" || kind === "finance") {
    if (!canAccess(user.modules, "finance")) return new Response("Forbidden", { status: 403 });
    const rows = await getCurrentTransactions();
    const csv = toCSV(
      ["Posting Date", "Document No", "Account No", "Account", "Description", "Amount", "Kind"],
      rows.map((t) => [
        t.postingDate, t.documentNo, t.glAccountNo, t.glAccountName, t.description, t.amount, t.kind,
      ]),
    );
    await logUsage({ actorId: user.id, actorLabel: user.email, action: "view", targetType: "export", detail: "transactions.csv" });
    return csvResponse(csv, `dsec-finance-${today()}.csv`);
  }

  return new Response("Unknown export kind", { status: 404 });
}
