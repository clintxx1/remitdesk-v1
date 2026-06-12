# RemitDesk

Scan PCSO lotto-agent documents, extract the key fields with in-browser OCR, and
keep a reconciled **running-balance ledger** you can export to Excel. A sibling to
`lottery-importer` — same stack, different documents and data. Everything runs
client-side; no data leaves the device.

## What it does

Upload **N images** at once. Each is OCR-scanned (Tesseract.js), classified, and
turned into one ledger entry. Only **three document types** are accepted — anything
else is rejected with a toast.

| Document | Agent number | Date | Amount | Reference (dedup) | Ledger effect |
| --- | --- | --- | --- | --- | --- |
| **Total Current Day report** (thermal receipt) | `AGENCY ID` | report date | `NET` | — | **NET DUE (+)** liability |
| **ONCOL payment slip** (LandBank) | `AGENT CODE` (validation stamp) | validation date | `AMOUNT PHP` (stamp) | validation `date-time-trace` | **DEPOSIT (−)** |
| **EPP confirmation** (lbp-eservices) | `Agency No.` | `Date` | `TOTAL AMOUNT` | `Reference Number` | **DEPOSIT (−)** |

**Running balance** (derived, per agent, chronological):

```
Balance = Beginning Balance + Σ NET DUE − Σ Deposits
```

Agent numbers are normalised to digits, so `413-0133-3` ≡ `41301333` groups a
report with its payments. **Reference numbers block double-entry** — re-scanning a
deposit whose reference (or a report whose agent+date) is already recorded is
rejected as a duplicate.

> **OCR accuracy (measured on the sample photos via `npm run ocr`):** the **EPP**
> confirmation is a clean screenshot and auto-extracts every field. The **Total Current
> Day report** prints under a heavy pink watermark and the **ONCOL slip** carries a
> handwritten amount plus a faint dot-matrix validation stamp — both are *recognised*
> (classified) but their values often can't be read by Tesseract at all, so they're added
> as **"needs review"** rows (amber flag) where you key in agent / amount / date. The
> parser never emits a guessed value: a field is either read correctly or left blank.
> A red-channel preprocessing pass strips the report's watermark (it helps, but can't
> rebuild text the watermark sits on top of). For fully-automatic extraction of all three
> documents — including the handwriting and faint stamp — plug in the optional **free
> Gemini engine** below; it produces the same `ParsedDoc`, with Tesseract as fallback.

## Optional: free AI extraction (Gemini)

By default everything runs offline on Tesseract. To also auto-extract the watermarked
report and the handwritten ONCOL slip, plug in a **free** Google Gemini key:

1. Get a key (no credit card) at <https://aistudio.google.com/apikey>
2. `cp .env.example .env.local` and set `GEMINI_API_KEY=...`
3. Restart `npm run dev` — a **Scan engine** toggle (AI · Gemini / Offline) appears.

The image is sent to Google via the `/api/extract` server route and mapped into the
same `ParsedDoc` the offline path returns; if the AI call fails for any reason it falls
back to Tesseract automatically. The free tier **rate-limits rather than bills** — you
can't be charged unless you explicitly enable billing on the Google project. Note that
on the free tier Google may use the data to improve its models, and these are payment
slips. Override the model with `GEMINI_MODEL` if you like.

## Features

- Multi-file drag-and-drop upload with a per-file **scan queue** (pending → scanning
  → added / duplicate / not-accepted / error)
- Dashboard summary cards: total net due, total deposits, outstanding balance, agents
- Editable ledger table grouped by agent, with inline editing and running balances
- Per-agent **beginning balances** (modal)
- Search, doc-type segmented filter, agent / amount / date filters, clear-all
- Pagination
- **Excel export** (ExcelJS) — one styled table grouped by agent with BEGINNING rows
- Modal confirmations for every destructive action (no native `alert`/`confirm`)
- Persists to `localStorage`

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm test         # parser fixtures (lib/parse.ts) for the 3 doc types + rejection
npm run ocr      # real OCR on samples/*.jpg — per-field results (add --raw for text)
```

Drop sample photos into `samples/` (git-ignored) to test OCR end-to-end. `npm run ocr`
runs the exact browser pipeline (red-channel + 3-variant voting) under Node.

## Stack

Next.js 16 (App Router, root `app/`) · React 19 · TypeScript · Tailwind v4 ·
Tesseract.js · ExcelJS · Radix (Dialog / AlertDialog / Popover) · react-day-picker ·
sonner · lucide-react.

## Layout

```
app/        layout, page (orchestrator), globals, icon, api/extract (Gemini route)
components/  AppHeader, SummaryCards, UploadDropzone, ScanQueue, LedgerToolbar,
             FiltersPanel, LedgerTable, Pagination, BeginningBalancesDialog,
             ConfirmDialog, DocBadge, Date(Range)Picker, ui/*
lib/         types, ocr, classify, parse, preprocess, extract (Gemini client),
             balance, dedup, filter, storage, xlsx, money, agent, date, cn
scripts/     test-parse.ts, ocr-samples.ts
```
