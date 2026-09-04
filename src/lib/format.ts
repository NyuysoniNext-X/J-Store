/**
 * Format a number as FCFA currency (French locale, no decimal places).
 * Canonical: use this everywhere instead of the formatXAF alias in mock-data.ts.
 */
export function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(amount)) + " FCFA";
}

/** Alias kept for backwards compat with existing callers of formatXAF */
export const formatXAF = formatFCFA;

/**
 * Format an ISO date string to a human-readable date.
 * Defaults to "dd MMM yyyy" in French (matches Cameroon convention).
 */
export function formatDate(
  value: string | Date,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
  locale = "fr-FR",
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString(locale, opts);
}

/**
 * Format an ISO date string to a short relative-ish label.
 * "Today · 10:24", "Yesterday", "22 mai" etc.
 */
export function formatRelativeDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffDays === 0) {
    const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return `Today · ${time}`;
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString("fr-FR", { weekday: "long" });
  }
  return formatDate(date);
}

/**
 * Truncate a UUID to the short order reference format.
 * e.g. "JS-X7K2P9"
 */
export function shortOrderId(id: string): string {
  return `JS-${id.slice(0, 6).toUpperCase()}`;
}
