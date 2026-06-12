"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatAgent } from "@/lib/agent";
import { parseMoney } from "@/lib/money";
import type { BeginningBalances } from "@/lib/types";

type Agent = { key: string; label: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  values: BeginningBalances;
  onSave: (next: BeginningBalances) => void;
};

/** Per-agent opening balances (yesterday's balance). Balance = opening + Σ net due − Σ deposits. */
export function BeginningBalancesDialog({
  open,
  onOpenChange,
  agents,
  values,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const a of agents) {
      next[a.key] = values[a.key] != null ? String(values[a.key]) : "";
    }
    setDraft(next);
  }, [open, agents, values]);

  function save() {
    const next: BeginningBalances = { ...values };
    for (const a of agents) {
      const raw = (draft[a.key] ?? "").trim();
      if (!raw) {
        delete next[a.key];
      } else {
        next[a.key] = parseMoney(raw) ?? 0;
      }
    }
    onSave(next);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-indigo-600" />
            Beginning balances
          </DialogTitle>
          <DialogDescription>
            Set each agent&apos;s opening balance (yesterday&apos;s balance) — use a
            negative value if PCSO owes the agent. Running balance = opening + net due −
            deposits.
          </DialogDescription>
        </DialogHeader>

        {agents.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No agents yet. Scan a document first, then set its opening balance here.
          </p>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {agents.map((a) => (
              <div key={a.key} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-medium text-slate-800">
                    {formatAgent(a.label)}
                  </p>
                </div>
                <div className="relative w-40 shrink-0">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    ₱
                  </span>
                  <input
                    inputMode="decimal"
                    value={draft[a.key] ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [a.key]: e.target.value }))
                    }
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-6 pr-2.5 text-right text-sm tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <button className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
              Cancel
            </button>
          </DialogClose>
          <button
            onClick={save}
            disabled={agents.length === 0}
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            Save balances
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
