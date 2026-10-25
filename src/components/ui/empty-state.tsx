import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("mx-auto flex max-w-xs flex-col items-center text-center", className)}>
      {Icon ? (
        <Icon
          className="mb-3 h-6 w-6 text-muted-foreground"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      ) : null}
      <p className="text-sm font-semibold text-[color:var(--ink)]">{title}</p>
      {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
