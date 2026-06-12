import { isDeposit, type DocType, type LedgerEntry } from "./types";

/** Canonical form of a reference for comparison (case/space/dash-insensitive). */
export function normalizeReference(ref: string): string {
  return (ref ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

export type DuplicateKind = "reference" | "report";
export type DuplicateHit = { kind: DuplicateKind; entry: LedgerEntry };

export type DedupCandidate = {
  docType: DocType;
  agentKey: string;
  date: string;
  reference: string;
};

/**
 * A scan is a duplicate when:
 *  - oncol/epp: an existing deposit already carries the same reference (proof of
 *    payment) — this is what blocks recording the same payment twice; or
 *  - report: a Total Current Day report already exists for the same agent + date
 *    (one report per agent per day).
 *
 * A deposit with no reference can't be deduped, so it's allowed through (the
 * user can add the reference later to lock it).
 */
export function findDuplicate(
  entries: LedgerEntry[],
  candidate: DedupCandidate,
  ignoreId?: string,
): DuplicateHit | null {
  if (isDeposit(candidate.docType)) {
    const ref = normalizeReference(candidate.reference);
    if (!ref) return null;
    const hit = entries.find(
      (e) =>
        e.id !== ignoreId &&
        isDeposit(e.docType) &&
        normalizeReference(e.reference) === ref,
    );
    return hit ? { kind: "reference", entry: hit } : null;
  }

  const hit = entries.find(
    (e) =>
      e.id !== ignoreId &&
      e.docType === "report" &&
      e.agentKey !== "" &&
      e.agentKey === candidate.agentKey &&
      e.date !== "" &&
      e.date === candidate.date,
  );
  return hit ? { kind: "report", entry: hit } : null;
}
