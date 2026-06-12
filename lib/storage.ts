import type { BeginningBalances, DocType, LedgerEntry } from "./types";

const ENTRIES_KEY = "remitdesk.entries.v1";
const BALANCES_KEY = "remitdesk.beginningBalances.v1";

const DOC_TYPES = new Set<DocType>(["report", "oncol", "epp"]);

type LooseEntry = Partial<LedgerEntry> & Record<string, unknown>;

/** Coerce a stored object into a complete entry (defaults for missing fields). */
function normalizeEntry(r: LooseEntry, i: number): LedgerEntry | null {
  if (!r || typeof r !== "object") return null;
  if (!DOC_TYPES.has(r.docType as DocType)) return null;
  return {
    id: typeof r.id === "string" && r.id ? r.id : `legacy-${i}`,
    createdAt: typeof r.createdAt === "number" ? r.createdAt : i,
    docType: r.docType as DocType,
    agentNumber: typeof r.agentNumber === "string" ? r.agentNumber : "",
    agentKey: typeof r.agentKey === "string" ? r.agentKey : "",
    date: typeof r.date === "string" ? r.date : "",
    amount:
      typeof r.amount === "number" && Number.isFinite(r.amount) ? r.amount : 0,
    reference: typeof r.reference === "string" ? r.reference : "",
    remarks: typeof r.remarks === "string" ? r.remarks : "",
  };
}

/** Load saved entries from localStorage (returns [] on SSR or bad data). */
export function loadEntries(): LedgerEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ENTRIES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((r, i) => normalizeEntry(r as LooseEntry, i))
      .filter((x): x is LedgerEntry => x !== null);
  } catch {
    return [];
  }
}

/** Persist entries to localStorage (no-op on SSR / quota errors). */
export function saveEntries(entries: LedgerEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

/** Load per-agent beginning balances (returns {} on SSR or bad data). */
export function loadBeginningBalances(): BeginningBalances {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(BALANCES_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: BeginningBalances = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Persist beginning balances (no-op on SSR / quota errors). */
export function saveBeginningBalances(b: BeginningBalances): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BALANCES_KEY, JSON.stringify(b));
  } catch {
    /* ignore quota / private-mode errors */
  }
}
