"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/* ------------------------- Calendar grid ----------------------------- */
export function Calendar({
  value,
  onSelect,
  className,
  disabledDays,
}: {
  value: Date | null;
  onSelect: (date: Date) => void;
  className?: string;
  disabledDays?: (date: Date) => boolean;
}) {
  const [view, setView] = React.useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const monthLabel = format(view, "MMMM yyyy");
  const today = new Date();
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const offset = first.getDay(); // 0 Sun
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const move = (delta: number) => {
    const d = new Date(view.getFullYear(), view.getMonth() + delta, 1);
    setView(d);
  };

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between px-1 pb-2">
        <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => move(-1)}>
          <ChevronLeft />
        </Button>
        <span className="text-sm font-medium" aria-live="polite">
          {monthLabel}
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => move(1)}>
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <span key={d} className="py-1 text-[11px] font-medium text-muted-foreground">
            {d}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const isSelected = value ? sameDay(d, value) : false;
          const isToday = sameDay(d, today);
          const disabled = disabledDays?.(d);
          return (
            <button
              key={d.toISOString()}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(d)}
              aria-label={format(d, "PPPP")}
              aria-pressed={isSelected}
              className={cn(
                "flex h-8 w-full items-center justify-center rounded-md text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-35",
                isSelected
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "hover:bg-accent",
                isToday && !isSelected && "font-semibold text-primary"
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------- Date picker ------------------------------- */
export function DatePicker({
  value,
  onValueChange,
  placeholder = "Pick a date",
  allowClear = true,
  align = "start",
  disabled,
  className,
}: {
  value: Date | null;
  onValueChange: (date: Date | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  align?: "start" | "center" | "end";
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-start gap-2 font-normal", !value && "text-muted-foreground", className)}
        >
          <CalendarIcon className="size-4 shrink-0" aria-hidden />
          <span className="flex-1 truncate text-left">{value ? format(value, "MMM d, yyyy") : placeholder}</span>
          {value && allowClear ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date"
              className="rounded text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onValueChange(null);
                setOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onValueChange(null);
                  setOpen(false);
                }
              }}
            >
              <CalendarIcon className="hidden" />
              ✕
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-3">
        <Calendar value={value} onSelect={(d) => { onValueChange(d); setOpen(false); }} />
      </PopoverContent>
    </Popover>
  );
}
