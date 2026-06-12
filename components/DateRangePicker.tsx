"use client";

import { useRef, useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { isoToDisplay, isoToLocalDate, localDateToISO } from "@/lib/date";

type Props = {
  from: string; // ISO YYYY-MM-DD or ""
  to: string;
  onChange: (from: string, to: string) => void;
  className?: string;
};

export function DateRangePicker({ from, to, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  // react-day-picker returns {from === to} on the first click and extends on the
  // second, so we close only after the second (completing) click.
  const awaitingEnd = useRef(false);

  const hasValue = Boolean(from || to);
  const selected: DateRange | undefined = hasValue
    ? { from: isoToLocalDate(from), to: isoToLocalDate(to) }
    : undefined;
  const label = hasValue
    ? `${from ? isoToDisplay(from) : "…"} – ${to ? isoToDisplay(to) : "…"}`
    : "Any date";

  return (
    <div className={cn("relative", className)}>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) awaitingEnd.current = false;
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex w-full items-center gap-2 rounded-lg border border-slate-300 bg-white py-1.5 pl-2.5 pr-8 text-left text-sm transition-colors hover:bg-slate-50 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
              hasValue ? "text-slate-800" : "text-slate-400",
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="flex-1 truncate">{label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent>
          <Calendar
            mode="range"
            selected={selected}
            defaultMonth={selected?.from ?? selected?.to}
            onSelect={(range) => {
              onChange(
                range?.from ? localDateToISO(range.from) : "",
                range?.to ? localDateToISO(range.to) : "",
              );
              if (!range?.from) {
                awaitingEnd.current = false;
              } else if (awaitingEnd.current) {
                awaitingEnd.current = false;
                setOpen(false);
              } else {
                awaitingEnd.current = true;
              }
            }}
          />
        </PopoverContent>
      </Popover>

      {hasValue && (
        <button
          type="button"
          onClick={() => onChange("", "")}
          title="Clear range"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
