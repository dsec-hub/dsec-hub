// Controlled vocabularies for the club domain. Used to populate form <select>s
// and to drive status colours. Values match what the dashboard queries expect.

export const EVENT_STATUSES = [
  "Idea",
  "Planning",
  "Confirmed",
  "Completed",
  "Cancelled",
] as const;

export const EVENT_TYPES = [
  "Social",
  "Networking",
  "Workshop",
  "Flagship",
  "Meeting",
  "Outreach",
  "Other",
] as const;

export const DUSA_STATUSES = [
  "Not Started",
  "Submitted",
  "Approved",
  "Rejected",
  "Not Required",
] as const;

export const EVENT_FORMATS = ["In-person", "Online", "Hybrid"] as const;

/**
 * The 8 link-tree accents (canonical lowercase). These map to brand colour
 * tokens in dsec-website's globals.css; the `swatch` here is only an approximate
 * preview for the dashboard editor's colour chips. `accent` null on a link ⇒ the
 * public page auto-cycles a colour by visible position. KEEP the names in sync
 * with the shared link-tree contract + dsec-website.
 */
export const LINK_ACCENTS = [
  { value: "blue", label: "Blue", swatch: "#3b82f6" },
  { value: "pink", label: "Pink", swatch: "#e91e63" },
  { value: "yellow", label: "Yellow", swatch: "#f5b700" },
  { value: "mint", label: "Mint", swatch: "#34d399" },
  { value: "sky", label: "Sky", swatch: "#38bdf8" },
  { value: "violet", label: "Violet", swatch: "#8b5cf6" },
  { value: "lime", label: "Lime", swatch: "#84cc16" },
  { value: "coral", label: "Coral", swatch: "#fb7185" },
] as const;

export type LinkAccent = (typeof LINK_ACCENTS)[number]["value"];

export const LINK_ACCENT_VALUES: readonly string[] = LINK_ACCENTS.map((a) => a.value);

/** Swatch hex by accent value (for live previews in the editor). */
export const LINK_ACCENT_SWATCH: Record<string, string> = Object.fromEntries(
  LINK_ACCENTS.map((a) => [a.value, a.swatch]),
);

export const PERSON_TYPES = [
  "Exec",
  "Committee Lead",
  "Committee Member",
  "General Member",
  "External Contact",
] as const;

export const PERSON_STATUSES = ["Active", "Inactive", "Alumni", "Prospect"] as const;

// Historical default committees. The editable source of truth is now the
// `committee` DB table (Admin → Committees); these names seed it via
// scripts/create-committee-table.ts. App code reads the DB list (see
// lib/committee-queries.ts), not this constant.
export const COMMITTEES = [
  "Executive",
  "Events",
  "Marketing",
  "Sponsorship",
  "Technical",
  "Operations",
] as const;

export const SPONSOR_STAGES = [
  "Prospect",
  "Contacted",
  "Negotiating",
  "Secured",
  "Declined",
] as const;

export const SPONSOR_TIERS = ["Bronze", "Silver", "Gold", "Platinum", "Custom"] as const;

/** Whether a record is a money sponsor or an in-kind partner. Null = Sponsor. */
export const RELATIONSHIP_TYPES = ["Sponsor", "Partner"] as const;

/** Kinds of support a sponsor/partner can provide — financial AND in-kind. Used
 * on sponsors and events (a partner may run an event for us with no money). */
export const SUPPORT_TYPES = [
  "Cash",
  "In-kind",
  "Venue",
  "Food",
  "Speakers",
  "Prizes",
  "Marketing",
  "MC",
  "Volunteers",
  "Equipment",
  "Other",
] as const;

/** Roles a person can hold on a sponsorship relationship. */
export const SPONSOR_CONTACT_ROLES = [
  "Organiser",
  "Contact",
  "Decision Maker",
  "Signatory",
  "Finance",
  "Other",
] as const;

export const LEAD_STATUSES = ["new", "contacted", "converted", "closed"] as const;

export const LEAD_SOURCES = ["pricing_unlock", "enquiry", "cal_booking"] as const;

export function leadStatusVariant(status: string | null | undefined): BadgeVariant {
  switch (status) {
    case "converted":
      return "success";
    case "contacted":
      return "accent";
    case "closed":
      return "neutral";
    default:
      return "warning"; // new
  }
}

// Partner relationship pipeline (lightweight — not the full sponsor CRM).
// A sourced club starts as a "lead"; existing collaborators are "active".
export const PARTNER_STATUSES = ["lead", "contacted", "active", "inactive"] as const;

export const PARTNER_STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  contacted: "Contacted",
  active: "Active",
  inactive: "Inactive",
};

export function partnerStatusVariant(status: string | null | undefined): BadgeVariant {
  switch (status) {
    case "active":
      return "success";
    case "contacted":
      return "accent";
    case "inactive":
      return "neutral";
    default:
      return "warning"; // lead
  }
}

export const FINANCE_TYPES = [
  "Grant",
  "Sponsorship Income",
  "Reimbursement",
  "Other Expense",
] as const;

export const FINANCE_STATUSES = [
  "Requested",
  "Invoiced",
  "Pending",
  "Approved",
  "Paid",
  "Rejected",
] as const;

// Status -> badge variant, for consistent colour across the app.
export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger";

export function dusaVariant(status: string | null | undefined): BadgeVariant {
  switch (status) {
    case "Approved":
    case "Not Required":
      return "success";
    case "Submitted":
      return "accent";
    case "Rejected":
      return "danger";
    default:
      return "warning"; // Not Started / unknown
  }
}

export function eventStatusVariant(status: string | null | undefined): BadgeVariant {
  switch (status) {
    case "Confirmed":
      return "success";
    case "Planning":
      return "accent";
    case "Idea":
      return "warning";
    case "Cancelled":
      return "danger";
    default:
      return "neutral"; // Completed
  }
}

export function financeStatusVariant(status: string | null | undefined): BadgeVariant {
  switch (status) {
    case "Paid":
      return "success";
    case "Rejected":
      return "danger";
    case "Approved":
    case "Invoiced":
      return "accent";
    default:
      return "warning"; // Requested / Pending
  }
}

export function personStatusVariant(status: string | null | undefined): BadgeVariant {
  switch (status) {
    case "Active":
      return "success";
    case "Prospect":
      return "accent";
    default:
      return "neutral"; // Inactive / Alumni
  }
}

export function sponsorStageVariant(stage: string | null | undefined): BadgeVariant {
  switch (stage) {
    case "Secured":
      return "success";
    case "Negotiating":
      return "accent";
    case "Contacted":
      return "warning";
    case "Declined":
      return "danger";
    default:
      return "neutral"; // Prospect
  }
}
