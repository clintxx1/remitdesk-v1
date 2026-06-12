"use client";

import { useState } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { isoToDisplay, isoToLocalDate, localDateToISO } from "@/lib/date";

type Props = {
  value: string; // ISO YYYY-MM-DD or ""
  onChange: (iso: string) => void;
  placeholder?: string;
  className?: string;
};

export function DatePicker({ value, onChange, placeholder = "Pick a date", className }: Props) {
  const [open, setOpen] = useState(false);
  const selected = isoToLocalDate(value);

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex w-full items-center gap-2 rounded-lg border border-slate-300 bg-white py-1.5 pl-2.5 pr-8 text-left text-sm transition-colors hover:bg-slate-50 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500",
              value ? "text-slate-800" : "text-slate-400",
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="flex-1 truncate">
              {value ? isoToDisplay(value) : placeholder}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent>
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => {
              onChange(d ? localDateToISO(d) : "");
              if (d) setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          title="Clear date"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
