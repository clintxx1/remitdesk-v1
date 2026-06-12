"use client";

import "react-day-picker/style.css";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/cn";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// Indigo theming set inline so it wins over react-day-picker's own stylesheet.
const themeVars = {
  "--rdp-accent-color": "#4f46e5", // indigo-600 — selected day
  "--rdp-accent-background-color": "#eef2ff", // indigo-50 — range/hover
  "--rdp-today-color": "#4338ca", // indigo-700 — today
  "--rdp-day-width": "2.25rem",
  "--rdp-day-height": "2.25rem",
  "--rdp-day_button-width": "2.25rem",
  "--rdp-day_button-height": "2.25rem",
  fontSize: "0.875rem",
} as React.CSSProperties;

/**
 * react-day-picker calendar with month/year dropdown navigation, themed to the
 * app's indigo accent. The year range is relative to today (30 years back → 5
 * ahead), so it never goes stale; pass `startMonth`/`endMonth` to override.
 */
export function Calendar({
  className,
  captionLayout = "dropdown",
  startMonth,
  endMonth,
  ...props
}: CalendarProps) {
  const currentYear = new Date().getFullYear();
  const start = startMonth ?? new Date(currentYear - 30, 0);
  const end = endMonth ?? new Date(currentYear + 5, 11);

  return (
    <DayPicker
      showOutsideDays
      captionLayout={captionLayout}
      startMonth={start}
      endMonth={end}
      className={cn("p-3", className)}
      style={themeVars}
      {...props}
    />
  );
}
