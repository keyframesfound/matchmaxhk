import * as React from "react";

import { cn } from "@/lib/utils";

type ConsolePanelProps = {
  as?: "div" | "section";
  padding?: "none" | "sm" | "md" | "lg";
} & React.HTMLAttributes<HTMLElement>;

const panelPadding = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
} as const;

export function ConsolePanel({
  as: Element = "section",
  padding = "md",
  className,
  children,
  ...props
}: ConsolePanelProps) {
  return (
    <Element
      className={cn(
        "rounded-2xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)]",
        panelPadding[padding],
        className,
      )}
      {...props}
    >
      {children}
    </Element>
  );
}
