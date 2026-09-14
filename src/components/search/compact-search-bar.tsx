import { Search } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Trigger classes for the borderless filter chips that sit inside a
 * CompactSearchBar's horizontally scrollable strip. Chip triggers are direct
 * children of the strip so its `divide-x` rules draw the separators, and
 * labels truncate like the reference design ("Sub..").
 */
export const compactChipTriggerClass =
  "flex h-10 w-24 shrink-0 items-center justify-between gap-1 rounded-none border-0 bg-transparent px-3 text-left text-xs font-semibold hover:border-[color:var(--ink)]/15 hover:bg-transparent";

type CompactSearchBarProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  /** Accessible label for the keyword input; falls back to the placeholder. */
  inputAriaLabel?: string;
  /** Accessible label for the circular submit button. */
  submitLabel: string;
  submitColor?: ButtonProps["color"];
  onSubmit: () => void;
  className?: string;
  /** Filter chips rendered in the horizontally scrollable strip. */
  children: ReactNode;
};

export function CompactSearchBar({
  value,
  onValueChange,
  placeholder,
  inputAriaLabel,
  submitLabel,
  submitColor = "neutral",
  onSubmit,
  className,
  children,
}: CompactSearchBarProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <div className={cn("rounded-sm border border-border bg-card", className)}>
      <form className="flex items-center gap-2 p-2" onSubmit={handleSubmit}>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            className="h-10 rounded-sm pl-9 text-sm"
            placeholder={placeholder}
            aria-label={inputAriaLabel ?? placeholder}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
          />
        </div>
        <Button
          type="submit"
          variant="solid"
          color={submitColor}
          aria-label={submitLabel}
          className="h-10 w-10 shrink-0 rounded-full p-0"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
      <div className="mm-scroll-x-hidden flex items-stretch divide-x divide-border overflow-x-auto border-t border-border">
        {children}
      </div>
    </div>
  );
}
