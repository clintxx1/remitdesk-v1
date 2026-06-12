import { Banknote, Scale, TrendingUp, Users } from "lucide-react";
import type { LedgerTotals } from "@/lib/balance";
import { cn } from "@/lib/cn";
import { formatPeso } from "@/lib/money";

type Tone = "amber" | "teal" | "indigo" | "slate";

const ICON_TONE: Record<Tone, string> = {
  amber: "bg-amber-100 text-amber-600",
  teal: "bg-teal-100 text-teal-600",
  indigo: "bg-indigo-100 text-indigo-600",
  slate: "bg-slate-100 text-slate-600",
};

/** Dashboard headline stats across the whole ledger. */
export function SummaryCards({ totals }: { totals: LedgerTotals }) {
  const cards: {
    label: string;
    value: string;
    hint: string;
    tone: Tone;
    Icon: typeof Scale;
  }[] = [
    {
      label: "Total Net Due",
      value: formatPeso(totals.netDue) || "₱0.00",
      hint: "liabilities (+)",
      tone: "amber",
      Icon: TrendingUp,
    },
    {
      label: "Total Deposits",
      value: formatPeso(totals.deposit) || "₱0.00",
      hint: "payments (−)",
      tone: "teal",
      Icon: Banknote,
    },
    {
      label: "Outstanding Balance",
      value: formatPeso(totals.outstanding) || "₱0.00",
      hint: "owed across agents",
      tone: "indigo",
      Icon: Scale,
    },
    {
      label: "Agents",
      value: String(totals.agents),
      hint: "with activity",
      tone: "slate",
      Icon: Users,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {c.label}
            </span>
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", ICON_TONE[c.tone])}>
              <c.Icon className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-slate-900 tabular-nums">
            {c.value}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">{c.hint}</p>
        </div>
      ))}
    </div>
  );
}
