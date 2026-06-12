import { isDeposit, type BeginningBalances, type LedgerEntry } from "./types";

/** A computed display row: an entry plus its split columns and running balance. */
export type LedgerRow = LedgerEntry & {
  netDue: number; // amount when report, else 0
  deposit: number; // amount when oncol/epp, else 0
  balance: number; // running per-agent balance through this entry
};

/** Chronological order within an agent: by date, then insertion order. */
function byDateThenSeq(a: LedgerEntry, b: LedgerEntry): number {
  if (a.date !== b.date) {
    if (!a.date) return 1; // undated sinks to the bottom of the agent's block
    if (!b.date) return -1;
    return a.date < b.date ? -1 : 1;
  }
  return a.createdAt - b.createdAt;
}

/**
 * Display rows sorted by agent then date, each carrying its running per-agent
 * balance: balance = beginning[agent] + Σ NET DUE − Σ deposit, applied in
 * chronological order. Computing it over the full set in date order means each
 * row's balance stays correct no matter how the view is later filtered/paged.
 */
export function computeLedger(
  entries: LedgerEntry[],
  beginning: BeginningBalances,
): LedgerRow[] {
  const byAgent = new Map<string, LedgerEntry[]>();
  for (const e of entries) {
    const list = byAgent.get(e.agentKey) ?? [];
    list.push(e);
    byAgent.set(e.agentKey, list);
  }

  const rows: LedgerRow[] = [];
  for (const agent of [...byAgent.keys()].sort()) {
    const list = byAgent.get(agent)!.slice().sort(byDateThenSeq);
    let running = beginning[agent] ?? 0;
    for (const e of list) {
      const netDue = isDeposit(e.docType) ? 0 : e.amount;
      const deposit = isDeposit(e.docType) ? e.amount : 0;
      running += netDue - deposit;
      rows.push({ ...e, netDue, deposit, balance: running });
    }
  }
  return rows;
}

export type LedgerTotals = {
  netDue: number;
  deposit: number;
  outstanding: number; // Σ beginning + Σ NET DUE − Σ deposit (agents present)
  agents: number;
};

/** Headline totals across every entry (the true ledger state, ignoring filters). */
export function computeTotals(
  entries: LedgerEntry[],
  beginning: BeginningBalances,
): LedgerTotals {
  let netDue = 0;
  let deposit = 0;
  const agents = new Set<string>();
  for (const e of entries) {
    agents.add(e.agentKey);
    if (isDeposit(e.docType)) deposit += e.amount;
    else netDue += e.amount;
  }
  let beginningSum = 0;
  for (const a of agents) beginningSum += beginning[a] ?? 0;
  return {
    netDue,
    deposit,
    outstanding: beginningSum + netDue - deposit,
    agents: agents.size,
  };
}

/** Distinct non-empty agents present, sorted by key — for filters and balances. */
export function distinctAgents(
  entries: LedgerEntry[],
): { key: string; label: string }[] {
  const map = new Map<string, string>();
  for (const e of entries) {
    if (!e.agentKey) continue;
    if (!map.has(e.agentKey)) map.set(e.agentKey, e.agentNumber || e.agentKey);
  }
  return [...map.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
