export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Format a date as a fixed "18 Sep 2025". Deterministic by design: it reads from
 * a hardcoded month table rather than `toLocaleDateString`/`Intl`, whose output
 * depends on the ICU/CLDR data bundled with the runtime and so can differ
 * between the Node server (e.g. "Sept") and the browser (e.g. "Sep") — even with
 * the locale pinned — which surfaces as a hydration mismatch. For YYYY-MM-DD
 * strings the parts are parsed directly, so the result is timezone-independent
 * too. (Change "Sep" → "Sept" in the table if you prefer the AU long form.)
 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  if (typeof value === "string") {
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (iso) {
      const month = MONTHS_SHORT[Number(iso[2]) - 1];
      if (month) return `${Number(iso[3])} ${month} ${iso[1]}`;
    }
  }
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** Format a 24h "HH:MM[:SS]" time as a friendly "6:30 PM"; "" if empty/invalid. */
export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return "";
  const h = Number(m[1]);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${period}`;
}

export function formatAUD(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2,
  }).format(n);
}

/** Whole days from local midnight today to the given date (negative = past). */
export function daysUntil(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Today as an ISO date string (YYYY-MM-DD), for date inputs and comparisons. */
export function todayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
