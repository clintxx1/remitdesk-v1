/**
 * Parse a peso amount from OCR or user text into a number. Handles the forms
 * that appear across the three documents: "PHP 11,160.00", "₱17,400.00",
 * "11,160", "11159.42". Currency markers, spaces and stray symbols are dropped;
 * commas are treated as thousands separators (our amounts use "." for decimals).
 *
 * Signed: a leading minus ("-500"), a trailing accounting minus ("674.32-", as PCSO
 * thermal receipts print negatives) or parentheses ("(500)") all yield a negative
 * number — a report NET can be negative when PCSO owes the agent. Callers that need a
 * strictly-positive magnitude (deposits) take Math.abs() of the result. Returns null
 * when there's no parseable number.
 */
export function parseMoney(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (input == null) return null;

  const raw = String(input).replace(/php|pesos?|₱/gi, "").trim();
  const negative = /^-/.test(raw) || /-\s*$/.test(raw) || /^\(.*\)$/.test(raw);

  let s = raw.replace(/[^0-9.,]/g, ""); // keep only digits, comma, dot
  if (!s) return null;
  s = s.replace(/,/g, ""); // commas are thousands separators
  s = s.replace(/\.$/, ""); // drop a trailing lone dot
  if (!s || s === ".") return null;

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Format a number as pesos with cents, e.g. 11160 -> "11,160.00". "" for nullish. */
export function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format with a ₱ prefix, e.g. "₱11,160.00". "" for nullish. */
export function formatPeso(n: number | null | undefined): string {
  const s = formatMoney(n);
  return s ? `₱${s}` : "";
}
