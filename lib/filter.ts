import { parseMoney } from "./money";
import type { DocType, LedgerEntry } from "./types";

/** Filter state. `docType` is driven by the segmented control above the table. */
export type Filters = {
  docType: "" | DocType; // "" = all
  agent: string; // agentKey, "" = all
  amountMin: string;
  amountMax: string;
  dateFrom: string; // ISO YYYY-MM-DD
  dateTo: string;
};

export const EMPTY_FILTERS: Filters = {
  docType: "",
  agent: "",
  amountMin: "",
  amountMax: "",
  dateFrom: "",
  dateTo: "",
};

/** Active filters excluding the docType segmented control (counted separately). */
export function activeFilterCount(f: Filters): number {
  return [f.agent, f.amountMin, f.amountMax, f.dateFrom, f.dateTo].filter(
    (v) => v.trim() !== "",
  ).length;
}

/**
 * Apply the search box (agent number / reference / remarks) and column filters.
 * Generic over the row type so it preserves computed `LedgerRow` fields. ISO
 * date strings compare correctly as plain strings, so date ranges are lexical.
 */
export function filterEntries<T extends LedgerEntry>(
  rows: T[],
  search: string,
  f: Filters,
): T[] {
  const q = search.trim().toLowerCase();
  const lo = f.amountMin ? parseMoney(f.amountMin) : null;
  const hi = f.amountMax ? parseMoney(f.amountMax) : null;
  return rows.filter((e) => {
    if (
      q &&
      !`${e.agentNumber} ${e.agentKey} ${e.reference} ${e.remarks}`
        .toLowerCase()
        .includes(q)
    ) {
      return false;
    }
    if (f.docType && e.docType !== f.docType) return false;
    if (f.agent && e.agentKey !== f.agent) return false;
    if (lo != null && e.amount < lo) return false;
    if (hi != null && e.amount > hi) return false;
    if (f.dateFrom && (!e.date || e.date < f.dateFrom)) return false;
    if (f.dateTo && (!e.date || e.date > f.dateTo)) return false;
    return true;
  });
}
