import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import type { EmptyStateProps } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type ConsoleTableDensity = "compact" | "comfortable";

const DensityContext = React.createContext<ConsoleTableDensity>("comfortable");

interface ConsoleTableProps extends React.HTMLAttributes<HTMLDivElement> {
  density?: ConsoleTableDensity;
  tableClassName?: string;
  minTableWidth?: string;
}

export function ConsoleTable({
  density = "comfortable",
  tableClassName,
  minTableWidth,
  className,
  children,
  ...props
}: ConsoleTableProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] shadow-[0_1px_3px_rgba(4,19,68,0.04)]",
        className,
      )}
      {...props}
    >
      <div className="overflow-x-auto">
        <table
          className={cn("w-full text-sm", tableClassName)}
          style={minTableWidth ? { minWidth: minTableWidth } : undefined}
        >
          <DensityContext.Provider value={density}>{children}</DensityContext.Provider>
        </table>
      </div>
    </div>
  );
}

const cellPadding = {
  compact: { th: "px-4 py-3.5", td: "px-4 py-3.5" },
  comfortable: { th: "px-5 py-3.5", td: "px-5 py-4" },
} as const;

export function ConsoleTableHead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "border-b border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)]/60 text-left text-xs font-medium text-[color:var(--ink)]/60",
        className,
      )}
      {...props}
    />
  );
}

export function ConsoleTableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("divide-y divide-[color:var(--ink)]/[0.07]", className)} {...props} />
  );
}

interface ConsoleThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right";
}

export function ConsoleTh({ align = "left", className, ...props }: ConsoleThProps) {
  const density = React.useContext(DensityContext);
  return (
    <th
      className={cn(cellPadding[density].th, align === "right" && "text-right", className)}
      {...props}
    />
  );
}

interface ConsoleTdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right";
}

export function ConsoleTd({ align = "left", className, ...props }: ConsoleTdProps) {
  const density = React.useContext(DensityContext);
  return (
    <td
      className={cn(cellPadding[density].td, align === "right" && "text-right", className)}
      {...props}
    />
  );
}

interface ConsoleTableSkeletonRowsProps {
  columns: number;
  rows?: number;
}

const skeletonWidths = ["w-28", "w-24", "w-20", "w-32", "w-16", "w-28", "w-20", "w-24", "w-28"];

export function ConsoleTableSkeletonRows({ columns, rows = 5 }: ConsoleTableSkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <ConsoleTd key={colIndex}>
              <Skeleton className={cn("h-4", skeletonWidths[colIndex % skeletonWidths.length])} />
            </ConsoleTd>
          ))}
        </tr>
      ))}
    </>
  );
}

interface ConsoleTableEmptyProps extends EmptyStateProps {
  colSpan: number;
}

export function ConsoleTableEmpty({ colSpan, ...emptyStateProps }: ConsoleTableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-12 text-center text-muted-foreground">
        <EmptyState {...emptyStateProps} />
      </td>
    </tr>
  );
}
