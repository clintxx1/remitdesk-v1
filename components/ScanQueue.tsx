"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  FileWarning,
  Loader2,
} from "lucide-react";
import { DocBadge } from "@/components/DocBadge";
import { cn } from "@/lib/cn";
import type { DocType } from "@/lib/types";

export type ScanStatus =
  | "pending"
  | "scanning"
  | "added"
  | "duplicate"
  | "invalid"
  | "error";

export type QueueItem = {
  id: string;
  name: string;
  status: ScanStatus;
  message?: string;
  docType?: DocType | null;
};

const META: Record<
  ScanStatus,
  { Icon: typeof Clock; cls: string; spin?: boolean; label: string }
> = {
  pending: { Icon: Clock, cls: "text-slate-400", label: "Waiting" },
  scanning: { Icon: Loader2, cls: "text-indigo-600", spin: true, label: "Scanning" },
  added: { Icon: CheckCircle2, cls: "text-teal-600", label: "Added" },
  duplicate: { Icon: Copy, cls: "text-amber-600", label: "Duplicate" },
  invalid: { Icon: FileWarning, cls: "text-rose-600", label: "Not accepted" },
  error: { Icon: AlertCircle, cls: "text-rose-600", label: "Error" },
};

type Props = {
  items: QueueItem[];
  progress: number; // 0..1 for the scanning item
  progressLabel: string;
  onClear: () => void;
};

export function ScanQueue({ items, progress, progressLabel, onClear }: Props) {
  if (items.length === 0) return null;
  const active = items.some((i) => i.status === "pending" || i.status === "scanning");
  const pct = Math.round(progress * 100);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-slate-700">
          Scan queue <span className="font-normal text-slate-400">· {items.length}</span>
        </h3>
        <button
          onClick={onClear}
          disabled={active}
          className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 disabled:opacity-40"
        >
          Clear
        </button>
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => {
          const m = META[it.status];
          return (
            <li
              key={it.id}
              className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
            >
              <div className="flex items-center gap-2.5">
                <m.Icon className={cn("h-4 w-4 shrink-0", m.cls, m.spin && "animate-spin")} />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                  {it.name}
                </span>
                {it.docType ? <DocBadge docType={it.docType} /> : null}
                <span className={cn("shrink-0 text-xs font-medium", m.cls)}>{m.label}</span>
              </div>

              {it.status === "scanning" ? (
                <div className="mt-1.5 pl-7">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-indigo-100">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all duration-200"
                      style={{ width: `${Math.max(6, pct)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {progressLabel}
                    {pct > 0 ? ` · ${pct}%` : "…"}
                  </p>
                </div>
              ) : (
                it.message && (
                  <p className="mt-1 pl-7 text-xs text-slate-500">{it.message}</p>
                )
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
