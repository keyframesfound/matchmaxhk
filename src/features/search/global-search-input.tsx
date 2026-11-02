import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Hash, Search } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { trailingTagPrefix } from "@/features/search/global-search";
import { searchTagTypeahead } from "@/features/search/search.functions";

const TYPEAHEAD_DEBOUNCE_MS = 200;
const TYPEAHEAD_STALE_MS = 60_000;
const BLUR_CLOSE_MS = 120;

type Props = {
  initialQuery?: string;
  /** Tags already selected on /search (kept when the query is re-submitted). */
  tags?: string[];
  scope?: "all" | "tutors" | "notes";
  className?: string;
  compact?: boolean;
};

/**
 * #553 global search bar: free text + `#` hashtag typeahead (≤8 public tags).
 * Enter / Search always opens the dedicated /search page (SoT); picking a
 * suggestion opens /search filtered to that exact tag.
 */
export function GlobalSearchInput({
  initialQuery = "",
  tags = [],
  scope = "all",
  className,
  compact = false,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const listId = useId();
  const [value, setValue] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const prefix = trailingTagPrefix(value);
  const [debounced, setDebounced] = useState<string | null>(null);

  useEffect(() => setValue(initialQuery), [initialQuery]);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(prefix), TYPEAHEAD_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [prefix]);

  const { data } = useQuery({
    queryKey: ["search", "typeahead", debounced],
    queryFn: () => searchTagTypeahead({ data: { prefix: debounced ?? "" } }),
    enabled: debounced !== null,
    staleTime: TYPEAHEAD_STALE_MS,
  });
  const suggestions = prefix !== null ? (data?.tags ?? []) : [];
  const showList = open && suggestions.length > 0;

  const go = (q: string, nextTags: string[]) => {
    setOpen(false);
    void navigate({
      to: "/search",
      search: { q: q.trim() || undefined, tag: nextTags.length ? nextTags : undefined, scope },
    });
  };

  const pick = (tag: string) => {
    const rest = value.replace(/(?:^|\s)#[^\s#]*$/, "").trim();
    go(rest, [...new Set([...tags, tag])]);
  };

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (showList && suggestions[active]) pick(suggestions[active]);
        else go(value, tags);
      }}
    >
      <label className="sr-only" htmlFor={`${listId}-input`}>
        {t("global_search.placeholder")}
      </label>
      <div
        className={cn(
          "flex items-center gap-2 rounded-full border border-border bg-background px-3",
          compact ? "h-10" : "h-12",
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder={t("global_search.placeholder")}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), BLUR_CLOSE_MS)}
          onKeyDown={(e) => {
            if (!showList) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {!compact && (
          <button
            type="submit"
            className="rounded-full bg-[color:var(--ink)] px-4 py-1.5 text-sm font-semibold text-background"
          >
            {t("global_search.submit")}
          </button>
        )}
      </div>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="mm-overlay-lift absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-border bg-popover py-1"
        >
          {suggestions.map((tag, i) => (
            <li
              key={tag}
              role="option"
              aria-selected={i === active}
              className={cn(
                "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm",
                i === active && "bg-[color:var(--foreground)]/[0.06]",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(tag);
              }}
            >
              <Hash className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {tag}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
