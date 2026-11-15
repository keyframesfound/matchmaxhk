import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Hash, School, Search, X } from "lucide-react";
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import {
  EMPTY_EXPLORE_TYPEAHEAD,
  toExploreSuggestions,
  type ExploreSuggestion,
} from "@/features/search/explore-typeahead";
import { searchExploreTypeahead } from "@/features/search/search.functions";

const TYPEAHEAD_DEBOUNCE_MS = 220;
const TYPEAHEAD_STALE_MS = 60_000;
const LIST_ID_MAX_HEIGHT = "max-h-72";

export type ExploreKeywordPicks = {
  onPickTag: (tag: string) => void;
  onPickSubject: (subject: string) => void;
  onPickTutor: (code: string) => void;
  onPickSchool: (school: string) => void;
};

/**
 * #771 §2.3: the Explore keyword field (phone sheet + Mac Keyword segment)
 * with the same #553 hybrid typeahead as /search — public `#tags` first, then
 * Subjects · Tutors · Schools. Cold start still shows the Popular chips
 * outside this input; Enter on free text keeps the caller's submit behaviour
 * (Explore filters its own grid, the global bar goes to /search).
 */
export function ExploreKeywordInput({
  value,
  onValueChange,
  onEnter,
  placeholder,
  ariaLabel,
  autoFocus = false,
  picks,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  onEnter?: () => void;
  placeholder: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  picks: ExploreKeywordPicks;
  className?: string;
}) {
  const { t } = useTranslation();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [debounced, setDebounced] = useState("");

  const trimmed = value.trim();
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(trimmed), TYPEAHEAD_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [trimmed]);

  const { data } = useQuery({
    queryKey: ["search", "explore-typeahead", debounced],
    queryFn: () => searchExploreTypeahead({ data: { prefix: debounced } }),
    enabled: debounced.length >= 1,
    staleTime: TYPEAHEAD_STALE_MS,
  });
  const suggestions =
    debounced.length >= 1 ? toExploreSuggestions(data ?? EMPTY_EXPLORE_TYPEAHEAD) : [];
  const showList = open && suggestions.length > 0;
  // Keeps the highlighted row inside the list when the payload shrinks.
  const activeIndex = Math.min(active, Math.max(0, suggestions.length - 1));

  const pick = (suggestion: ExploreSuggestion) => {
    setOpen(false);
    if (suggestion.kind === "tag") picks.onPickTag(suggestion.value);
    else if (suggestion.kind === "subject") picks.onPickSubject(suggestion.value);
    else if (suggestion.kind === "tutor") picks.onPickTutor(suggestion.value);
    else picks.onPickSchool(suggestion.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (showList) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        return;
      }
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }
    if (showList) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((index) => (index + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((index) => (index - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === "Enter" && suggestions[activeIndex]) {
        event.preventDefault();
        pick(suggestions[activeIndex]);
        return;
      }
    }
    if (event.key === "Enter") {
      if (!onEnter) return;
      event.preventDefault();
      onEnter();
    }
  };

  const iconFor = (kind: ExploreSuggestion["kind"]) =>
    kind === "tag"
      ? Hash
      : kind === "subject"
        ? GraduationCap
        : kind === "school"
          ? School
          : Search;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative flex items-center">
        <Search
          className="pointer-events-none absolute left-4 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          className="h-13 w-full rounded-2xl border border-[color:var(--ink)]/20 bg-transparent pl-11 pr-10 text-base font-medium text-[color:var(--ink)] placeholder:font-normal placeholder:text-muted-foreground transition-[border-color,background-color] focus:border-ring focus:bg-[color:var(--surface)] focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {value ? (
          <button
            type="button"
            aria-label={t("search_ui.clear_keyword")}
            onClick={() => {
              onValueChange("");
              setOpen(false);
            }}
            className="absolute right-3 flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--foreground)]/[0.08] text-[color:var(--ink)] transition-colors hover:bg-[color:var(--foreground)]/15"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className={cn(
            "space-y-0.5 overflow-y-auto rounded-2xl border border-border bg-card p-1",
            LIST_ID_MAX_HEIGHT,
          )}
        >
          {suggestions.map((suggestion, index) => {
            const Icon = iconFor(suggestion.kind);
            return (
              <li key={`${suggestion.kind}:${suggestion.value}`} className="min-w-0">
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  // Pointer-down keeps the input focused on iPad (blur otherwise
                  // closes the list before the tap lands).
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(suggestion)}
                  onPointerEnter={() => setActive(index)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                    index === activeIndex && "bg-[color:var(--foreground)]/[0.06]",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-medium text-[color:var(--ink)]">
                    {suggestion.label}
                  </span>
                  <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                    {suggestion.kind === "tutor"
                      ? suggestion.hint
                      : t(`search_ui.suggest_${suggestion.kind}`)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
