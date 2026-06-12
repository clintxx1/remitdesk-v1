"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Cpu, Download, Info, Plus, ShieldCheck, Sparkles, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { BeginningBalancesDialog } from "@/components/BeginningBalancesDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DocBadge } from "@/components/DocBadge";
import { LedgerTable } from "@/components/LedgerTable";
import { LedgerToolbar } from "@/components/LedgerToolbar";
import { Pagination } from "@/components/Pagination";
import { type QueueItem, ScanQueue } from "@/components/ScanQueue";
import { SummaryCards } from "@/components/SummaryCards";
import { UploadDropzone } from "@/components/UploadDropzone";
import { formatAgent } from "@/lib/agent";
import { computeLedger, computeTotals, distinctAgents } from "@/lib/balance";
import { cn } from "@/lib/cn";
import { isoToDisplay } from "@/lib/date";
import { findDuplicate } from "@/lib/dedup";
import { checkGeminiConfigured, extractWithGemini } from "@/lib/extract";
import { EMPTY_FILTERS, type Filters, filterEntries } from "@/lib/filter";
import { formatPeso } from "@/lib/money";
import { scanDocument } from "@/lib/ocr";
import {
  loadBeginningBalances,
  loadEntries,
  saveBeginningBalances,
  saveEntries,
} from "@/lib/storage";
import {
  type BeginningBalances,
  DOC_TAGS,
  type DocType,
  type LedgerEntry,
  type ParsedDoc,
} from "@/lib/types";
import { exportLedger } from "@/lib/xlsx";

const btnSecondary =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";

const PAGE_SIZES = [25, 50, 100];

const LEGEND: { docType: DocType; title: string; sub: string }[] = [
  { docType: "report", title: "Total Current Day", sub: "report → NET DUE (+)" },
  { docType: "oncol", title: "ONCOL slip", sub: "LandBank → Deposit (−)" },
  { docType: "epp", title: "EPP confirmation", sub: "e-payment → Deposit (−)" },
];

export default function Home() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [beginning, setBeginning] = useState<BeginningBalances>({});
  const [hydrated, setHydrated] = useState(false);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Preparing OCR engine");

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  const [balancesOpen, setBalancesOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [geminiReady, setGeminiReady] = useState<boolean | null>(null);
  const [useAI, setUseAI] = useState(true);

  const entriesRef = useRef<LedgerEntry[]>([]);
  const pendingRef = useRef<{ id: string; file: File }[]>([]);
  const processingRef = useRef(false);
  const geminiReadyRef = useRef(false);
  const useAIRef = useRef(true);

  // Load persisted state once.
  useEffect(() => {
    const e = loadEntries();
    const b = loadBeginningBalances();
    setEntries(e);
    entriesRef.current = e;
    setBeginning(b);
    setHydrated(true);
  }, []);

  // Keep the async-read mirror current and persist on change.
  useEffect(() => {
    entriesRef.current = entries;
    if (hydrated) saveEntries(entries);
  }, [entries, hydrated]);
  useEffect(() => {
    if (hydrated) saveBeginningBalances(beginning);
  }, [beginning, hydrated]);

  // Detect whether the free AI engine is available; mirror the engine flags into
  // refs so the async scan loop always reads the latest.
  useEffect(() => {
    checkGeminiConfigured().then(setGeminiReady).catch(() => setGeminiReady(false));
  }, []);
  useEffect(() => {
    geminiReadyRef.current = geminiReady === true;
  }, [geminiReady]);
  useEffect(() => {
    useAIRef.current = useAI;
  }, [useAI]);

  // Derived ledger (balance computed over the full set, then filtered + paged).
  const ledger = useMemo(() => computeLedger(entries, beginning), [entries, beginning]);
  const totals = useMemo(() => computeTotals(entries, beginning), [entries, beginning]);
  const agents = useMemo(() => distinctAgents(entries), [entries]);
  const filtered = useMemo(
    () => filterEntries(ledger, search, filters),
    [ledger, search, filters],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [search, filters, pageSize]);

  // --- Scanning -------------------------------------------------------------

  function applyParsed(jobId: string, parsed: ParsedDoc) {
    if (!parsed.docType) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === jobId
            ? { ...q, status: "invalid", message: "Not a Total Current Day, ONCOL, or EPP document." }
            : q,
        ),
      );
      toast.error("Unrecognized document", {
        description: "Upload a Total Current Day report, ONCOL slip, or EPP confirmation.",
      });
      return;
    }

    const dup = findDuplicate(entriesRef.current, {
      docType: parsed.docType,
      agentKey: parsed.agentKey,
      date: parsed.date,
      reference: parsed.reference,
    });
    if (dup) {
      const msg =
        dup.kind === "reference"
          ? `Reference ${parsed.reference} is already recorded.`
          : `A report for this agent on ${isoToDisplay(parsed.date) || "this date"} already exists.`;
      setQueue((prev) =>
        prev.map((q) =>
          q.id === jobId ? { ...q, status: "duplicate", docType: parsed.docType, message: msg } : q,
        ),
      );
      toast.error("Duplicate — not added", { description: msg });
      return;
    }

    const entry: LedgerEntry = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      docType: parsed.docType,
      agentNumber: parsed.agentNumber,
      agentKey: parsed.agentKey,
      date: parsed.date,
      amount: parsed.amount ?? 0,
      reference: parsed.reference,
      remarks: "",
      raw: parsed.raw,
    };
    const next = [...entriesRef.current, entry];
    entriesRef.current = next;
    setEntries(next);

    const detail = `${DOC_TAGS[parsed.docType]} · ${formatAgent(parsed.agentNumber) || "agent?"} · ${
      parsed.date ? isoToDisplay(parsed.date) : "no date"
    } · ${formatPeso(parsed.amount) || "amount?"}`;
    setQueue((prev) =>
      prev.map((q) =>
        q.id === jobId
          ? {
              ...q,
              status: "added",
              docType: parsed.docType,
              message: parsed.valid ? detail : `Added — check ${parsed.reason}.`,
            }
          : q,
      ),
    );
    if (parsed.valid) toast.success("Entry added", { description: detail });
    else toast.warning("Added — needs review", { description: `${detail} · ${parsed.reason}` });
  }

  async function runExtraction(file: File): Promise<ParsedDoc> {
    const onTesseract = (frac: number, label: string) => {
      setProgress(frac);
      setProgressLabel(label);
    };
    // Prefer the free AI engine when configured; fall back to offline OCR on any error.
    if (geminiReadyRef.current && useAIRef.current) {
      try {
        setProgress(0.2);
        setProgressLabel("Reading with AI…");
        const parsed = await extractWithGemini(file);
        setProgress(1);
        return parsed;
      } catch (err) {
        console.error("AI extraction failed; falling back to offline OCR", err);
        setProgressLabel("AI busy — offline OCR…");
        toast.warning("AI engine busy — used offline OCR", {
          description: "That scan fell back to Tesseract; re-scan to retry AI.",
        });
      }
    }
    return scanDocument(file, onTesseract);
  }

  async function processQueue() {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);
    try {
      while (pendingRef.current.length > 0) {
        const job = pendingRef.current.shift()!;
        setQueue((prev) => prev.map((q) => (q.id === job.id ? { ...q, status: "scanning" } : q)));
        setProgress(0);
        setProgressLabel("Preparing OCR engine");
        try {
          const parsed = await runExtraction(job.file);
          applyParsed(job.id, parsed);
        } catch (err) {
          console.error(err);
          setQueue((prev) =>
            prev.map((q) =>
              q.id === job.id
                ? { ...q, status: "error", message: "Couldn't read this image. Try a sharper, straight-on photo." }
                : q,
            ),
          );
          toast.error("Couldn't read the image", { description: job.file.name });
        }
      }
    } finally {
      processingRef.current = false;
      setProcessing(false);
      setProgress(0);
    }
  }

  function enqueue(files: File[]) {
    const items: QueueItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      status: "pending",
    }));
    setQueue((prev) => [...prev, ...items]);
    items.forEach((it, i) => pendingRef.current.push({ id: it.id, file: files[i] }));
    void processQueue();
  }

  // --- Ledger actions -------------------------------------------------------

  function handleUpdate(entry: LedgerEntry) {
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? entry : e)));
    toast.success("Entry updated");
  }

  function handleDelete(ids: string[]) {
    setEntries((prev) => prev.filter((e) => !ids.includes(e.id)));
    toast.success(ids.length > 1 ? `${ids.length} entries deleted` : "Entry deleted");
  }

  function handleAddEntry() {
    const entry: LedgerEntry = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      docType: "report",
      agentNumber: "",
      agentKey: "",
      date: "",
      amount: 0,
      reference: "",
      remarks: "",
    };
    setEntries((prev) => [...prev, entry]);
    toast.success("Blank entry added", { description: "Edit it in the table below." });
  }

  function handleClearLedger() {
    setEntries([]);
    setClearOpen(false);
    toast.success("Ledger cleared");
  }

  function handleClearFilters() {
    setSearch("");
    setFilters(EMPTY_FILTERS);
  }

  async function handleExport() {
    try {
      const n = await exportLedger(entries, beginning);
      toast.success(`Exported ${n} ${n === 1 ? "entry" : "entries"} to Excel`);
    } catch (err) {
      console.error(err);
      toast.error("Export failed");
    }
  }

  function handleSaveBalances(next: BeginningBalances) {
    setBeginning(next);
    toast.success("Beginning balances saved");
  }

  const hasEntries = entries.length > 0;

  return (
    <div className="min-h-full">
      <AppHeader />

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <SummaryCards totals={totals} />

        <section className="mt-5 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-2 flex items-center justify-between gap-2 px-1">
              <span className="text-xs font-medium text-slate-500">Scan engine</span>
              {geminiReady === null ? (
                <span className="text-xs text-slate-400">checking…</span>
              ) : geminiReady ? (
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium">
                  <button
                    onClick={() => setUseAI(true)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors",
                      useAI ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800",
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> AI · Gemini
                  </button>
                  <button
                    onClick={() => setUseAI(false)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors",
                      !useAI ? "bg-white text-slate-700 shadow-sm" : "text-slate-500 hover:text-slate-800",
                    )}
                  >
                    <Cpu className="h-3.5 w-3.5" /> Offline
                  </button>
                </div>
              ) : (
                <span
                  className="text-xs text-slate-400"
                  title="Add GEMINI_API_KEY to .env.local to enable free AI extraction"
                >
                  Offline OCR · <span className="text-slate-500">add GEMINI_API_KEY for AI</span>
                </span>
              )}
            </div>
            {geminiReady === true && (
              <p className="mb-2 flex items-start gap-1.5 px-1 text-xs text-slate-400">
                {useAI ? (
                  <>
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span>
                      AI mode uploads each image to Google for extraction — switch to
                      Offline (above) to keep them on this device.
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-500" />
                    <span>Offline — images are read on this device and never uploaded.</span>
                  </>
                )}
              </p>
            )}
            <UploadDropzone onFiles={enqueue} busy={processing} />
          </div>
          <div className="lg:col-span-1">
            {queue.length > 0 ? (
              <ScanQueue
                items={queue}
                progress={progress}
                progressLabel={progressLabel}
                onClear={() => setQueue([])}
              />
            ) : (
              <div className="flex h-full flex-col justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  What you can scan
                </p>
                {LEGEND.map((l) => (
                  <div key={l.docType} className="flex items-center gap-2.5">
                    <DocBadge docType={l.docType} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700">{l.title}</p>
                      <p className="text-xs text-slate-400">{l.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-700">Ledger</h2>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                {entries.length}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setBalancesOpen(true)} className={btnSecondary}>
                <Wallet className="h-4 w-4" /> Beginning balances
              </button>
              <button onClick={handleAddEntry} className={btnSecondary}>
                <Plus className="h-4 w-4" /> Add entry
              </button>
              <button
                onClick={() => setClearOpen(true)}
                disabled={!hasEntries}
                className={btnSecondary}
              >
                <Trash2 className="h-4 w-4" /> Clear
              </button>
              <button
                onClick={() => void handleExport()}
                disabled={!hasEntries}
                className={btnPrimary}
              >
                <Download className="h-4 w-4" /> Export .xlsx
              </button>
            </div>
          </div>

          {hasEntries && (
            <div className="mb-3">
              <LedgerToolbar
                search={search}
                onSearchChange={setSearch}
                docType={filters.docType}
                onDocTypeChange={(d) => setFilters((f) => ({ ...f, docType: d }))}
                filters={filters}
                onFiltersChange={setFilters}
                agents={agents}
                onClearAll={handleClearFilters}
                filteredCount={filtered.length}
                totalCount={entries.length}
              />
            </div>
          )}

          <LedgerTable
            rows={paged}
            beginning={beginning}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />

          {filtered.length > PAGE_SIZES[0] && (
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              pageSize={pageSize}
              total={filtered.length}
              pageSizeOptions={PAGE_SIZES}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </section>

        <footer className="mt-10 text-center text-xs text-slate-400">
          Runs entirely in your browser · OCR by Tesseract.js · Balance = opening +
          net due − deposits, per agent
        </footer>
      </main>

      <BeginningBalancesDialog
        open={balancesOpen}
        onOpenChange={setBalancesOpen}
        agents={agents}
        values={beginning}
        onSave={handleSaveBalances}
      />

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear the entire ledger?"
        description={`This permanently removes all ${entries.length} entries. Beginning balances are kept. This can't be undone.`}
        confirmLabel="Clear ledger"
        destructive
        onConfirm={handleClearLedger}
      />
    </div>
  );
}
