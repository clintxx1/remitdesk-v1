"use client";

import { Fragment, useState } from "react";
import { Check, Pencil, Trash2, TriangleAlert, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DatePicker } from "@/components/DatePicker";
import { DocBadge } from "@/components/DocBadge";
import { formatAgent, normalizeAgentKey } from "@/lib/agent";
import type { LedgerRow } from "@/lib/balance";
import { cn } from "@/lib/cn";
import { isoToDisplay } from "@/lib/date";
import { formatMoney, formatPeso, parseMoney } from "@/lib/money";
import { DOC_LABELS, isDeposit, type BeginningBalances, type DocType, type LedgerEntry } from "@/lib/types";

type Props = {
  rows: LedgerRow[]; // already computed + filtered + paged
  beginning: BeginningBalances;
  onUpdate: (entry: LedgerEntry) => void;
  onDelete: (ids: string[]) => void;
};

type Draft = {
  date: string;
  agentNumber: string;
  docType: DocType;
  amount: string;
  reference: string;
  remarks: string;
};

const COL_COUNT = 10; // checkbox + 8 columns + actions
const cellInput =
  "w-full min-w-20 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export function LedgerTable({ rows, beginning, onUpdate, onDelete }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState<{ ids: string[] } | null>(null);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function startEdit(row: LedgerRow) {
    setEditingId(row.id);
    setDraft({
      date: row.date,
      agentNumber: row.agentNumber,
      docType: row.docType,
      amount: row.amount ? String(row.amount) : "",
      reference: row.reference,
      remarks: row.remarks,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function saveEdit(row: LedgerRow) {
    if (!draft) return;
    const deposit = isDeposit(draft.docType);
    onUpdate({
      id: row.id,
      createdAt: row.createdAt,
      docType: draft.docType,
      agentNumber: formatAgent(draft.agentNumber),
      agentKey: normalizeAgentKey(draft.agentNumber),
      date: draft.date,
      amount: deposit ? Math.abs(parseMoney(draft.amount) ?? 0) : (parseMoney(draft.amount) ?? 0),
      reference: deposit ? draft.reference.trim() : "",
      remarks: draft.remarks.trim(),
      raw: row.raw,
    });
    cancelEdit();
  }

  function confirmDelete() {
    if (!confirm) return;
    onDelete(confirm.ids);
    setSelected((prev) => {
      const next = new Set(prev);
      confirm.ids.forEach((id) => next.delete(id));
      return next;
    });
    setConfirm(null);
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-sm font-medium text-slate-700">No matching entries</p>
        <p className="mt-1 text-sm text-slate-400">
          Upload a document above, or adjust your search and filters.
        </p>
      </div>
    );
  }

  let prevAgent: string | null = null;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-indigo-50 px-4 py-2.5">
          <span className="text-sm font-medium text-indigo-800">{selected.size} selected</span>
          <button
            onClick={() => setConfirm({ ids: [...selected] })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4" /> Delete selected
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 cursor-pointer accent-indigo-600"
                  aria-label="Select all rows on this page"
                />
              </th>
              <th className="whitespace-nowrap px-4 py-3">Date</th>
              <th className="whitespace-nowrap px-4 py-3">Agent</th>
              <th className="whitespace-nowrap px-4 py-3">Type</th>
              <th className="whitespace-nowrap px-4 py-3 text-right">Net Due</th>
              <th className="whitespace-nowrap px-4 py-3 text-right">Deposit</th>
              <th className="whitespace-nowrap px-4 py-3 text-right">Balance</th>
              <th className="whitespace-nowrap px-4 py-3">Reference</th>
              <th className="whitespace-nowrap px-4 py-3">Remarks</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const editing = editingId === row.id;
              const newAgent = row.agentKey !== prevAgent;
              prevAgent = row.agentKey;
              const depositDraft = draft ? isDeposit(draft.docType) : false;
              const noRef = isDeposit(row.docType) && !row.reference;
              // A report's amount may legitimately be 0 or negative, so flag only
              // entries missing the agent or date (the usual offline-OCR gaps).
              const needsReview = !row.agentKey || !row.date;

              return (
                <Fragment key={row.id}>
                  {newAgent && (
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      <td colSpan={COL_COUNT} className="px-4 py-1.5">
                        <span className="font-mono text-xs font-semibold text-slate-600">
                          {row.agentNumber ? formatAgent(row.agentNumber) : "— no agent —"}
                        </span>
                        <span className="ml-2 text-xs text-slate-400">
                          opening {formatPeso(beginning[row.agentKey] ?? 0) || "₱0.00"}
                        </span>
                      </td>
                    </tr>
                  )}
                  <tr
                    className={cn(
                      "border-b border-slate-100 align-middle transition-colors last:border-0",
                      needsReview && "border-l-2 border-l-amber-400",
                      selected.has(row.id) ? "bg-indigo-50/40" : "hover:bg-slate-50",
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggle(row.id)}
                        className="h-4 w-4 cursor-pointer accent-indigo-600"
                        aria-label="Select row"
                      />
                    </td>

                    {/* DATE */}
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {editing && draft ? (
                        <DatePicker
                          value={draft.date}
                          onChange={(v) => setDraft({ ...draft, date: v })}
                          className="min-w-36"
                        />
                      ) : (
                        isoToDisplay(row.date) || <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* AGENT */}
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono">
                      {editing && draft ? (
                        <input
                          value={draft.agentNumber}
                          onChange={(e) => setDraft({ ...draft, agentNumber: e.target.value })}
                          className={cellInput}
                        />
                      ) : (
                        formatAgent(row.agentNumber) || <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* TYPE */}
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {editing && draft ? (
                        <select
                          value={draft.docType}
                          onChange={(e) => setDraft({ ...draft, docType: e.target.value as DocType })}
                          className={cellInput}
                          title={DOC_LABELS[draft.docType]}
                        >
                          <option value="report">REPORT</option>
                          <option value="oncol">ONCOL</option>
                          <option value="epp">EPP</option>
                        </select>
                      ) : (
                        <div className="flex flex-col items-start gap-1">
                          <DocBadge docType={row.docType} />
                          {needsReview && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600">
                              <TriangleAlert className="h-3 w-3" /> review
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* NET DUE */}
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                      {editing && draft ? (
                        !depositDraft ? (
                          <input
                            inputMode="decimal"
                            value={draft.amount}
                            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                            className={cn(cellInput, "text-right")}
                            placeholder="0.00"
                          />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )
                      ) : row.netDue ? (
                        <span className="font-medium text-amber-700">{formatMoney(row.netDue)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* DEPOSIT */}
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                      {editing && draft ? (
                        depositDraft ? (
                          <input
                            inputMode="decimal"
                            value={draft.amount}
                            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                            className={cn(cellInput, "text-right")}
                            placeholder="0.00"
                          />
                        ) : (
                          <span className="text-slate-300">—</span>
                        )
                      ) : row.deposit ? (
                        <span className="font-medium text-teal-700">{formatMoney(row.deposit)}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* BALANCE */}
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                      {editing ? (
                        <span className="text-slate-300">auto</span>
                      ) : (
                        <span
                          className={cn(
                            "font-semibold",
                            row.balance < 0 ? "text-rose-600" : "text-slate-900",
                          )}
                        >
                          {formatMoney(row.balance)}
                        </span>
                      )}
                    </td>

                    {/* REFERENCE */}
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono">
                      {editing && draft ? (
                        depositDraft ? (
                          <input
                            value={draft.reference}
                            onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
                            className={cellInput}
                            placeholder="proof of payment"
                          />
                        ) : (
                          <span className="text-slate-300">n/a</span>
                        )
                      ) : (
                        <span className="flex items-center gap-1.5">
                          {noRef && (
                            <TriangleAlert
                              className="h-3.5 w-3.5 shrink-0 text-amber-500"
                              aria-label="No reference — this deposit can be entered twice"
                            />
                          )}
                          {row.reference || <span className="text-slate-300">—</span>}
                        </span>
                      )}
                    </td>

                    {/* REMARKS */}
                    <td className="px-4 py-2.5">
                      {editing && draft ? (
                        <input
                          value={draft.remarks}
                          onChange={(e) => setDraft({ ...draft, remarks: e.target.value })}
                          className={cellInput}
                        />
                      ) : (
                        <span className="text-slate-600">
                          {row.remarks || <span className="text-slate-300">—</span>}
                        </span>
                      )}
                    </td>

                    {/* ACTIONS */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {editing ? (
                          <>
                            <button
                              onClick={() => saveEdit(row)}
                              title="Save"
                              className="rounded-md p-1.5 text-indigo-600 hover:bg-indigo-50"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              title="Cancel"
                              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(row)}
                              title="Edit"
                              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setConfirm({ ids: [row.id] })}
                              title="Delete"
                              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm && confirm.ids.length > 1
            ? `Delete ${confirm.ids.length} entries?`
            : "Delete this entry?"
        }
        description="This permanently removes it from the ledger and recomputes balances. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}
