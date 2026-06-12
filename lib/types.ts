/** The three valid document types RemitDesk accepts. */
export type DocType = "report" | "oncol" | "epp";

/** Full human label per document type. */
export const DOC_LABELS: Record<DocType, string> = {
  report: "Total Current Day",
  oncol: "ONCOL Payment",
  epp: "EPP Payment",
};

/** Short tag shown in the TYPE column / Excel. */
export const DOC_TAGS: Record<DocType, string> = {
  report: "REPORT",
  oncol: "ONCOL",
  epp: "EPP",
};

/** report = liability (NET DUE, +); oncol/epp = deposit (payment, −). */
export function isDeposit(docType: DocType): boolean {
  return docType === "oncol" || docType === "epp";
}

/**
 * One ledger entry — the underlying record produced by scanning (or manually
 * adding) a single document. The running balance is derived, never stored.
 */
export type LedgerEntry = {
  id: string;
  /** ms epoch; stable tiebreaker for ordering entries on the same date. */
  createdAt: number;
  docType: DocType;
  /** Display form, e.g. "413-0133-3". */
  agentNumber: string;
  /** Digits-only key that unifies an agent across docs, e.g. "41301333". */
  agentKey: string;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  /** Pesos. NET DUE for a report; deposit amount for oncol/epp. */
  amount: number;
  /** Proof-of-payment reference (oncol/epp). "" for a report. Blocks re-entry. */
  reference: string;
  remarks: string;
  /** Raw OCR text, kept for debugging. */
  raw?: string;
};

/** Per-agent opening balance, keyed by agentKey. */
export type BeginningBalances = Record<string, number>;

/**
 * Result of scanning + parsing one image. `docType === null` means the image
 * didn't match any of the three accepted documents (→ rejected with a toast).
 */
export type ParsedDoc = {
  docType: DocType | null;
  valid: boolean;
  agentNumber: string;
  agentKey: string;
  date: string; // ISO YYYY-MM-DD or ""
  amount: number | null;
  reference: string;
  /** Human-readable note when unrecognized / missing fields. */
  reason: string;
  raw: string;
};
