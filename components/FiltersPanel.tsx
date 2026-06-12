"use client";

import { DateRangePicker } from "@/components/DateRangePicker";
import { formatAgent } from "@/lib/agent";
import type { Filters } from "@/lib/filter";

type Agent = { key: string; label: string };

type Props = {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  agents: Agent[];
};

const labelCls = "mb-1 block text-xs font-medium text-slate-500";
const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

export function FiltersPanel({ filters, onFiltersChange, agents }: Props) {
  const set = (patch: Partial<Filters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label className={labelCls}>Agent</label>
        <select
          value={filters.agent}
          onChange={(e) => set({ agent: e.target.value })}
          className={inputCls}
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.key} value={a.key}>
              {formatAgent(a.label)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>Amount (₱)</label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="decimal"
            placeholder="Min"
            value={filters.amountMin}
            onChange={(e) => set({ amountMin: e.target.value })}
            className={inputCls}
          />
          <span className="text-slate-400">–</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="Max"
            value={filters.amountMax}
            onChange={(e) => set({ amountMax: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Date</label>
        <DateRangePicker
          from={filters.dateFrom}
          to={filters.dateTo}
          onChange={(f, t) => set({ dateFrom: f, dateTo: t })}
        />
      </div>
    </div>
  );
}
