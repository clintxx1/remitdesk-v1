export const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * Coerce a Date or various date strings to canonical ISO `YYYY-MM-DD`.
 * Accepts `YYYY-MM-DD`, `D-Mon-YY[YY]` (e.g. 04-Jun-26), `M/D/YY[YY]`
 * (e.g. 6/4/2026), compact `DDMonYY[YY]` (e.g. 29MAY2026, 28MAY26) and
 * `Mon D, YYYY` (e.g. May 29, 2026). Returns "" when it can't be parsed.
 */
export function toISODate(input: unknown): string {
  if (input == null) return "";
  if (input instanceof Date) {
    return Number.isNaN(input.getTime())
      ? ""
      : `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())}`;
  }

  const s = String(input).trim();
  if (!s) return "";

  const fromMonth = (day: string, mon: string, year: string): string => {
    const mi = MONTHS.indexOf(mon.slice(0, 3).toLowerCase());
    if (mi < 0) return "";
    const yyyy = year.length >= 4 ? Number(year) : 2000 + Number(year);
    return `${yyyy}-${pad(mi + 1)}-${pad(Number(day))}`;
  };

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // D-Mon-YY[YY] / D Mon YY[YY]
  let m = s.match(/^(\d{1,2})[ \-]([A-Za-z]{3,})[ \-](\d{2,4})$/);
  if (m) {
    const iso = fromMonth(m[1], m[2], m[3]);
    if (iso) return iso;
  }

  // Compact DDMonYY[YY], e.g. 29MAY2026 / 28MAY26
  m = s.match(/^(\d{1,2})([A-Za-z]{3,})(\d{2,4})$/);
  if (m) {
    const iso = fromMonth(m[1], m[2], m[3]);
    if (iso) return iso;
  }

  // Mon D, YYYY / Mon D YYYY
  m = s.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (m) {
    const iso = fromMonth(m[2], m[1], m[3]);
    if (iso) return iso;
  }

  // M/D/YY[YY]
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const yyyy = m[3].length >= 4 ? Number(m[3]) : 2000 + Number(m[3]);
    return `${yyyy}-${pad(Number(m[1]))}-${pad(Number(m[2]))}`;
  }

  return "";
}

/** ISO `YYYY-MM-DD` -> `M/D/YYYY` (no leading zeros). "" if invalid. */
export function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return "";
  return `${Number(m[2])}/${Number(m[3])}/${Number(m[1])}`;
}

/**
 * ISO `YYYY-MM-DD` -> Date at UTC midnight (null if invalid). UTC keeps the
 * Excel date serial timezone-stable: a local-midnight Date would shift the
 * stored day in non-UTC zones, since spreadsheet serials are timezone-naive.
 */
export function isoToDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** ISO `YYYY-MM-DD` -> Date at LOCAL midnight (for calendar display). undefined if invalid. */
export function isoToLocalDate(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}

/** Local Date -> ISO `YYYY-MM-DD` using local calendar fields. */
export function localDateToISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
