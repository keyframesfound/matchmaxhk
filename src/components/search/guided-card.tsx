import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/** #605 §3.3: one guided group in the phone search sheet. */
export function GuidedCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border p-4">
      <h3 className="mb-3 text-base font-bold tracking-tight text-[color:var(--ink)]">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** #605 §3.3 step 7: More Filters accordion, collapsed by default on phone. */
export function MoreFiltersAccordion({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-base font-bold text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>
          {title}
          {count > 0 ? ` (${count})` : ""}
        </span>
        <ChevronDown
          className={cn("h-5 w-5 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="space-y-6 border-t border-border px-4 pt-4 pb-5">{children}</div>
      ) : null}
    </div>
  );
}
