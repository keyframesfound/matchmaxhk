import { Search, X } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Trigger classes for the borderless filter chips that sit inside a
 * CompactSearchBar's two-row chip grid. Chip triggers are direct children of
 * the grid so its nth-child rules draw the separators, and labels truncate
 * like the reference design ("Sub..").
 */
export const compactChipTriggerClass =
  "flex h-10 w-full items-center justify-between gap-1 rounded-none border-0 border-border bg-transparent px-3 text-left text-xs font-semibold hover:bg-transparent";

type CompactSearchBarProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  /** Accessible label for the keyword input; falls back to the placeholder. */
  inputAriaLabel?: string;
  /** Accessible label for the circular search toggle/submit button. */
  submitLabel: string;
  /** Accessible label for the button that collapses the keyword input. */
  closeLabel?: string;
  submitColor?: ButtonProps["color"];
  onSubmit: () => void;
  className?: string;
  /** Filter chips rendered in the two-row grid. */
  children: ReactNode;
};

export function CompactSearchBar({
  value,
  onValueChange,
  placeholder,
  inputAriaLabel,
  submitLabel,
  closeLabel = "Close search",
  submitColor = "neutral",
  onSubmit,
  className,
  children,
}: CompactSearchBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
    setSearchOpen(false);
  };

  return (
    <div className={cn("rounded-sm border border-border bg-card", className)}>
      <form onSubmit={handleSubmit}>
        {searchOpen && (
          <div className="flex items-center gap-2 border-b border-border p-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                autoFocus
                className="h-10 rounded-sm pl-9 text-sm"
                placeholder={placeholder}
                aria-label={inputAriaLabel ?? placeholder}
                value={value}
                onChange={(event) => onValueChange(event.target.value)}
                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setSearchOpen(false);
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={closeLabel}
              className="shrink-0 text-muted-foreground"
              onClick={() => setSearchOpen(false)}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch">
          <div className="grid grid-cols-2 [&>*:nth-child(even)]:border-l [&>*:nth-child(n+3)]:border-t">
            {children}
          </div>
          <div className="flex items-center justify-center border-l border-border p-2">
            <Button
              type={searchOpen ? "submit" : "button"}
              variant="solid"
              color={submitColor}
              aria-label={submitLabel}
              className="h-10 w-10 shrink-0 rounded-full p-0"
              onClick={searchOpen ? undefined : () => setSearchOpen(true)}
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
