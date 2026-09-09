import * as React from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { MTR_LINES, getNearestMtrStation } from "@/features/tutor-application/mtr";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function useMtrGroups(query: string) {
  return React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return MTR_LINES.map((line) => ({
      id: line.id,
      label: line.label,
      stations: normalized
        ? line.stations.filter(
            (station) =>
              station.toLowerCase().includes(normalized) ||
              line.label.toLowerCase().includes(normalized),
          )
        : line.stations,
    })).filter((line) => line.stations.length > 0);
  }, [query]);
}

type NearbyState = "idle" | "locating" | "error";

function useNearbyStation(onFound: (station: string) => void) {
  const { t } = useTranslation();
  const [state, setState] = React.useState<NearbyState>("idle");
  const onFoundRef = React.useRef(onFound);
  onFoundRef.current = onFound;

  const locate = React.useCallback(() => {
    if (!navigator.geolocation) {
      setState("error");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const station = getNearestMtrStation(position.coords.latitude, position.coords.longitude);
        if (!station) {
          setState("error");
          return;
        }
        setState("idle");
        onFoundRef.current(station);
      },
      () => setState("error"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, []);

  const hint =
    state === "locating"
      ? t("search_panel.nearby_locating")
      : state === "error"
        ? t("search_panel.nearby_failed")
        : t("search_panel.nearby_hint");

  return { state, locate, hint };
}

function AnimatedRowCheck({ selected }: { selected: boolean }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {selected ? (
        <motion.span
          className="ml-auto grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[color:var(--surface-invert)] text-[color:var(--surface-invert-fg)]"
          initial={shouldReduceMotion ? {} : { scale: 0 }}
          animate={shouldReduceMotion ? {} : { scale: 1 }}
          exit={shouldReduceMotion ? {} : { scale: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 400, damping: 25, mass: 0.5, duration: 0.2 }
          }
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

type PickerContentProps = {
  value?: string;
  onSelect: (station: string | undefined) => void;
  showAnyOption?: boolean;
  className?: string;
  listClassName?: string;
};

export function MtrStationPickerContent({
  value,
  onSelect,
  showAnyOption = true,
  className,
  listClassName,
}: PickerContentProps) {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const [query, setQuery] = React.useState("");
  const [highlighted, setHighlighted] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const anyStationLabel = t("search_panel.any_station");

  const handleFound = React.useCallback((station: string) => onSelect(station), [onSelect]);
  const nearby = useNearbyStation(handleFound);

  const groups = useMtrGroups(query);
  const searching = query.trim().length > 0;

  const flatStations = React.useMemo(() => groups.flatMap((group) => group.stations), [groups]);

  const highlightCount =
    (searching ? 0 : 1) + (showAnyOption && !searching ? 1 : 0) + flatStations.length;

  React.useEffect(() => {
    setHighlighted(0);
  }, [query]);

  React.useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, []);

  const moveHighlight = (delta: number) => {
    setHighlighted((prev) => {
      if (highlightCount === 0) return 0;
      const next = (prev + delta + highlightCount) % highlightCount;
      listRef.current
        ?.querySelector<HTMLElement>(`[data-highlight-index="${next}"]`)
        ?.scrollIntoView({ block: "nearest" });
      return next;
    });
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      let index = highlighted;
      if (!searching) {
        if (index === 0) {
          if (nearby.state !== "locating") nearby.locate();
          return;
        }
        index -= 1;
        if (showAnyOption) {
          if (index === 0) {
            onSelect(undefined);
            return;
          }
          index -= 1;
        }
      }
      const station = flatStations[index];
      if (station) onSelect(station);
    }
  };

  const rowClassName = (isHighlighted: boolean, isSelected: boolean) =>
    cn(
      "flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium text-[color:var(--ink)] transition-colors",
      isHighlighted ? "bg-[color:var(--ring)]/[0.08]" : "hover:bg-[color:var(--surface-subtle)]",
      isSelected && "font-semibold",
    );

  const renderRow = (
    key: string,
    index: number,
    content: React.ReactNode,
    action: () => void,
    selected: boolean,
    extraProps: { disabled?: boolean } = {},
  ) => (
    <motion.div
      key={key}
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, filter: "blur(4px)", x: -10 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, filter: "blur(0px)", x: 0 }}
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : {
              type: "spring",
              stiffness: 400,
              damping: 28,
              mass: 0.6,
              delay: Math.min(index * 0.02, 0.16),
            }
      }
    >
      <button
        type="button"
        data-highlight-index={index}
        onMouseEnter={() => setHighlighted(index)}
        onClick={action}
        className={rowClassName(index === highlighted, selected)}
        {...extraProps}
      >
        {content}
        <AnimatedRowCheck selected={selected} />
      </button>
    </motion.div>
  );

  let renderIndex = 0;

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="border-b border-[color:var(--ink)]/10 p-2">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-[color:var(--ink)]/40" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded
            aria-label={t("search_panel.search_station")}
            placeholder={t("search_panel.search_station")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className="h-9 w-full rounded-md border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] pl-8 pr-8 text-base font-medium text-[color:var(--ink)] placeholder:text-muted-foreground transition-[border-color,background-color,box-shadow] focus:border-ring focus:bg-[color:var(--surface)] focus:outline-none focus:ring-2 focus:ring-ring/40 sm:text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("search_panel.clear_search")}
              className="absolute right-2 rounded p-0.5 text-[color:var(--ink)]/40 hover:text-[color:var(--ink)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div ref={listRef} className={cn("max-h-72 overflow-y-auto p-1.5 text-sm", listClassName)}>
        {!searching
          ? renderRow(
              "nearby",
              renderIndex++,
              <span className="flex min-w-0 flex-col pr-2">
                <span className="truncate font-semibold">{t("search_panel.nearby")}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {nearby.hint}
                </span>
              </span>,
              () => nearby.locate(),
              false,
              { disabled: nearby.state === "locating" },
            )
          : null}

        {showAnyOption && !searching
          ? renderRow(
              "any",
              renderIndex++,
              <span className="truncate pr-2">{anyStationLabel}</span>,
              () => onSelect(undefined),
              !value,
            )
          : null}

        {groups.map((group) =>
          group.stations.map((station) =>
            renderRow(
              `${group.id}:${station}`,
              renderIndex++,
              <span className="truncate pr-2">{station}</span>,
              () => onSelect(station),
              value === station,
            ),
          ),
        )}

        {groups.length === 0 && (
          <div className="py-4 text-center text-xs text-muted-foreground">
            {t("search_panel.no_station")}
          </div>
        )}
      </div>
    </div>
  );
}

type MtrStationSelectProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showAnyOption?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  popoverClassName?: string;
};

export function MtrStationSelect({
  value,
  onChange,
  placeholder = "Select…",
  showAnyOption = true,
  disabled = false,
  invalid = false,
  className,
  popoverClassName,
}: MtrStationSelectProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className={cn(
            "group flex h-11 w-full items-center justify-between gap-2 rounded-md border border-[color:var(--ink)]/15 bg-[color:var(--surface)] px-3.5 py-2 text-left text-sm font-medium text-[color:var(--ink)] shadow-[0_1px_2px_rgba(4,19,68,0.04)] transition-[border-color,box-shadow,background-color] duration-150 hover:border-[color:var(--ink)]/30 hover:bg-[color:var(--surface)] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
            invalid &&
              "border-destructive hover:border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30",
            !value && "text-[color:var(--ink)]/50",
            className,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-[color:var(--ink)]/50 transition-transform duration-200",
              open && "rotate-180 text-[color:var(--ink)]",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "z-[9999] w-(--radix-popover-trigger-width) min-w-[220px] overflow-hidden border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-0 text-[color:var(--ink)] shadow-[0_20px_45px_-18px_rgba(4,19,68,0.25)]",
          popoverClassName,
        )}
      >
        <MtrStationPickerContent
          value={value}
          showAnyOption={showAnyOption}
          onSelect={(station) => {
            onChange(station ?? "");
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

type MtrStationMultiSelectProps = {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  popoverClassName?: string;
};

const ALL_MTR_STATIONS = MTR_LINES.flatMap((line) => line.stations);

export function MtrStationMultiSelect({
  value,
  onChange,
  placeholder = "Select stations…",
  disabled = false,
  className,
  popoverClassName,
}: MtrStationMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const groups = useMtrGroups(query);
  const selected = new Set(value);
  const triggerLabel =
    value.length > 0
      ? `${value.length} station${value.length === 1 ? "" : "s"} selected`
      : placeholder;

  const commit = (next: Set<string>) =>
    onChange(ALL_MTR_STATIONS.filter((station) => next.has(station)));

  const toggleStation = (station: string) => {
    const next = new Set(value);
    if (next.has(station)) next.delete(station);
    else next.add(station);
    commit(next);
  };

  const toggleLine = (lineStations: string[]) => {
    const includesEvery = lineStations.every((station) => selected.has(station));
    const next = new Set(value);
    if (includesEvery) lineStations.forEach((station) => next.delete(station));
    else lineStations.forEach((station) => next.add(station));
    commit(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          className={cn(
            "group flex h-10 w-full items-center justify-between gap-2 rounded-md border border-[color:var(--ink)]/15 bg-[color:var(--surface)] px-3 py-2 text-left text-xs font-medium text-[color:var(--ink)] shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-[color:var(--ink)]/30 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
            value.length === 0 && "text-[color:var(--ink)]/50",
            className,
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-[color:var(--ink)]/50 transition-transform duration-200",
              open && "rotate-180 text-[color:var(--ink)]",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "z-[9999] w-(--radix-popover-trigger-width) min-w-[240px] overflow-hidden border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-0 text-[color:var(--ink)] shadow-[0_20px_45px_-18px_rgba(4,19,68,0.25)]",
          popoverClassName,
        )}
      >
        <div className="border-b border-[color:var(--ink)]/10 p-2">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-[color:var(--ink)]/40" />
            <input
              type="text"
              aria-label="Search MTR stations"
              placeholder="Search MTR stations…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 w-full rounded-md border border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] pl-8 pr-3 text-xs font-medium text-[color:var(--ink)] placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5 text-sm">
          {groups.map((group) => {
            const allSelected = group.stations.every((station) => selected.has(station));
            const selectedCount = group.stations.filter((station) => selected.has(station)).length;
            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => toggleLine(group.stations)}
                  className="flex w-full items-center justify-between rounded-md px-2.5 pb-1 pt-2 text-left"
                >
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                    {selectedCount > 0 ? `${selectedCount} selected` : "Select all"}
                    {allSelected ? (
                      <Check className="h-3 w-3 text-[color:var(--ring)]" strokeWidth={2.5} />
                    ) : null}
                  </span>
                </button>
                {group.stations.map((station) => (
                  <button
                    key={`${group.id}:${station}`}
                    type="button"
                    onClick={() => toggleStation(station)}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between rounded-md px-3 py-1.5 text-left text-[13px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-subtle)]",
                      selected.has(station) && "font-semibold",
                    )}
                  >
                    <span className="truncate pr-2">{station}</span>
                    {selected.has(station) ? (
                      <Check
                        className="h-3.5 w-3.5 shrink-0 text-[color:var(--ring)]"
                        strokeWidth={2.5}
                      />
                    ) : null}
                  </button>
                ))}
              </div>
            );
          })}
          {groups.length === 0 && (
            <div className="py-4 text-center text-xs text-muted-foreground">No station found.</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
