"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { type Matcher } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/*
 * Single-date picker: the polished Calendar floating in a Popover behind an
 * outline trigger. Speaks Date; forms that hold "yyyy-mm-dd" strings convert
 * at the boundary with isoToDate/dateToIso so stored formats never move.
 */

type DatePickerProps = {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  /** Visible/accessible name for the trigger. */
  label: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  min?: Date;
  max?: Date;
  id?: string;
  className?: string;
};

export function DatePicker({
  value,
  onChange,
  label,
  placeholder = "Pick a date",
  disabled = false,
  invalid = false,
  min,
  max,
  id,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const disabledMatchers = React.useMemo(() => {
    const matchers: Matcher[] = [];
    if (min) matchers.push({ before: min });
    if (max) matchers.push({ after: max });
    return matchers.length > 0 ? matchers : undefined;
  }, [min, max]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={label}
          aria-invalid={invalid || undefined}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-[color:var(--ink)]/50",
            invalid && "border-destructive focus-visible:ring-destructive/30",
            className,
          )}
        >
          {value ? value.toLocaleDateString() : placeholder}
          <CalendarIcon className="h-4 w-4 text-[color:var(--ink)]/55" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
          disabled={disabledMatchers}
        />
      </PopoverContent>
    </Popover>
  );
}

/** "yyyy-mm-dd" (local midnight) -> Date; "" / undefined -> undefined. */
export function isoToDate(iso: string | undefined | null): Date | undefined {
  if (!iso) return undefined;
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Date -> "yyyy-mm-dd" in local time; undefined -> "". */
export function dateToIso(date: Date | undefined): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
