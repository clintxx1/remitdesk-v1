import { ScrollText } from "lucide-react";

/** Sticky brand bar. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight tracking-tight text-slate-900">
              RemitDesk
            </h1>
            <p className="text-xs leading-tight text-slate-500">
              PCSO agent remittance ledger
            </p>
          </div>
        </div>
        <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500 sm:inline">
          Runs in your browser · OCR by Tesseract.js
        </span>
      </div>
    </header>
  );
}
