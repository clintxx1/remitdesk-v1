"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { FiltersPanel } from "@/components/FiltersPanel";
import { cn } from "@/lib/cn";
import { activeFilterCount, type Filters } from "@/lib/filter";
import type { DocType } from "@/lib/types";

type Agent = { key: string; label: string };

const SEGMENTS: { value: "" | DocType; label: string }[] = [
  { value: "", label: "All" },
  { value: "report", label: "Report" },
  { value: "oncol", label: "ONCOL" },
  { value: "epp", label: "EPP" },
];

type Props = {
  search: string;
  onSearchChange: (s: string) => void;
  docType: "" | DocType;
  onDocTypeChange: (d: "" | DocType) => void;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  agents: Agent[];
  onClearAll: () => void;
  filteredCount: number;
  totalCount: number;
};

export function LedgerToolbar({
  search,
  onSearchChange,
  docType,
  onDocTypeChange,
  filters,
  onFiltersChange,
  agents,
  onClearAll,
  filteredCount,
  totalCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const active = activeFilterCount(filters);
  const anyActive = active > 0 || docType !== "" || search.trim() !== "";
  const isFiltered = filteredCount !== totalCount;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search agent number or reference…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-8 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {SEGMENTS.map((s) => (
            <button
              key={s.value || "all"}
              onClick={() => onDocTypeChange(s.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                docType === s.value
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            open || active > 0
              ? "border-indigo-300 bg-indigo-50 text-indigo-700"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters
          {active > 0 && (
            <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-semibold text-white">
              {active}
            </span>
          )}
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between px-1">
        <span className="text-xs text-slate-500">
          {isFiltered ? (
            <>
              <span className="font-semibold text-slate-700">{filteredCount}</span> of{" "}
              {totalCount} entries
            </>
          ) : (
            <>
              {totalCount} {totalCount === 1 ? "entry" : "entries"}
            </>
          )}
        </span>
        {anyActive && (
          <button
            onClick={() => {
              onClearAll();
              setOpen(false);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            <X className="h-3.5 w-3.5" /> Clear all filters
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <FiltersPanel filters={filters} onFiltersChange={onFiltersChange} agents={agents} />
        </div>
      )}
    </div>
  );
}
