// Helpers for reading FormData in Server Actions. Empty strings become null so
// optional columns stay null rather than "".

export function str(fd: FormData, key: string): string | null {
  const v = (fd.get(key) as string | null)?.trim();
  return v ? v : null;
}

export function int(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (v === null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

/** Numeric/decimal columns are string-mode in Drizzle — keep the value as a string. */
export function num(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : String(n);
}

export function bool(fd: FormData, key: string): boolean {
  return fd.get(key) != null; // a checked checkbox is present; unchecked is absent
}

/** Parse the ticket-tiers hidden input: a JSON array of {label, price}. Price
 * becomes a number (0 = free) or null (unset); rows without a label are dropped.
 * Returns null when empty so the optional JSON column stays null. */
export function tierList(
  fd: FormData,
  key: string,
): { label: string; price: number | null }[] | null {
  const v = str(fd, key);
  if (!v) return null;
  try {
    const parsed = JSON.parse(v);
    if (!Array.isArray(parsed)) return null;
    const list = parsed
      .map((t) => {
        const raw = t?.price;
        const price =
          raw === null || raw === undefined || raw === "" ? null : Number(raw);
        return { label: String(t?.label ?? "").trim(), price };
      })
      .filter((t) => t.label && (t.price === null || !Number.isNaN(t.price)));
    return list.length ? list : null;
  } catch {
    return null;
  }
}

/** Parse a hidden input holding a JSON string array (e.g. TagCheckboxGroup).
 * Returns null when empty so optional JSON columns stay null. */
export function jsonList(fd: FormData, key: string): string[] | null {
  const v = str(fd, key);
  if (!v) return null;
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) {
      const list = parsed.map((x) => String(x).trim()).filter(Boolean);
      return list.length ? list : null;
    }
  } catch {
    // ignore malformed input
  }
  return null;
}
