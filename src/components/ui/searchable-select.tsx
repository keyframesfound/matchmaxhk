/**
 * MatchMax searchable selector: mirrors the supplied reference with a portal-anchored
 * spring overlay, search-first list, animated option entry, and full keyboard support.
 */
import { Check, ChevronDown, Search, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type SearchableOption = { value: string; label?: string };

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: (string | SearchableOption)[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Allow the user's typed input as a free-form value (for "Other"). */
  allowCustom?: boolean;
  className?: string;
};

type MenuPosition = {
  left: number;
  top: number;
  width: number;
};

const initialPosition: MenuPosition = { left: 0, top: 0, width: 0 };

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches.",
  disabled = false,
  allowCustom = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [position, setPosition] = useState<MenuPosition>(initialPosition);
  const shouldReduceMotion = useReducedMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = `matchmax-dropdown-${useId().replace(/:/g, "")}`;

  const normalized = useMemo<SearchableOption[]>(
    () =>
      options.map((option) =>
        typeof option === "string"
          ? { value: option, label: option }
          : { value: option.value, label: option.label ?? option.value },
      ),
    [options],
  );
  const selected = normalized.find((option) => option.value === value);
  const displayLabel = selected?.label ?? (value || placeholder);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return normalized;

    return normalized.filter((option) =>
      `${option.label} ${option.value}`.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [normalized, query]);

  const updatePosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;

    const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 16);
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top: rect.bottom + 4,
      width,
    });
  };

  const closeMenu = useCallback((returnFocus = false) => {
    setOpen(false);
    setQuery("");
    setFocusedIndex(-1);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  const openMenu = () => {
    if (disabled) return;
    updatePosition();
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 100);
  };

  const selectOption = useCallback(
    (option: SearchableOption) => {
      onChange(option.value);
      closeMenu();
    },
    [closeMenu, onChange],
  );

  useEffect(() => {
    if (!open) return;

    const handleViewportChange = () => updatePosition();
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        closeMenu();
      }
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [closeMenu, open]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setFocusedIndex((current) =>
          filteredOptions.length ? (current < filteredOptions.length - 1 ? current + 1 : 0) : -1,
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setFocusedIndex((current) =>
          filteredOptions.length ? (current > 0 ? current - 1 : filteredOptions.length - 1) : -1,
        );
      } else if (event.key === "Home") {
        event.preventDefault();
        setFocusedIndex(filteredOptions.length ? 0 : -1);
      } else if (event.key === "End") {
        event.preventDefault();
        setFocusedIndex(filteredOptions.length - 1);
      } else if (event.key === "Enter" && focusedIndex >= 0) {
        event.preventDefault();
        const option = filteredOptions[focusedIndex];
        if (option) selectOption(option);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeMenu, filteredOptions, focusedIndex, open, selectOption]);

  const dropdownContent = (
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={menuRef}
          className="fixed z-50 origin-top overflow-hidden rounded-lg border border-[color:var(--ink)]/10 bg-[color:var(--surface)]/[0.96] text-[color:var(--ink)] shadow-[0_20px_45px_-18px_rgba(4,19,68,0.28)] backdrop-blur-xl"
          style={{ left: position.left, top: position.top, width: position.width }}
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scaleY: 0.8, y: -10 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scaleY: 1, y: 0 }}
          exit={
            shouldReduceMotion
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, scaleY: 0.8, y: -10, transition: { duration: 0.15 } }
          }
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 400, damping: 30, mass: 0.8, duration: 0.25 }
          }
        >
          <div className="relative border-b border-[color:var(--ink)]/10 p-2">
            <motion.div
              className="relative"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -10 }}
              animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 400, damping: 25, delay: 0.05, duration: 0.2 }
              }
            >
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[color:var(--ink)]/45" />
              <input
                ref={inputRef}
                aria-activedescendant={
                  focusedIndex >= 0
                    ? `${listboxId}-option-${filteredOptions[focusedIndex]?.value}`
                    : undefined
                }
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-expanded={open}
                aria-label={`Search ${placeholder.toLocaleLowerCase()} options`}
                className="h-10 w-full rounded-md border border-[color:var(--ink)]/10 bg-transparent py-2 pr-9 pl-9 text-sm font-medium text-[color:var(--ink)] outline-none transition-colors placeholder:text-[color:var(--ink)]/45 focus-visible:border-[#1FA8B6] focus-visible:ring-2 focus-visible:ring-[#1FA8B6] focus-visible:ring-offset-2"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setFocusedIndex(-1);
                }}
                placeholder={searchPlaceholder}
                role="combobox"
                type="text"
                value={query}
              />
              <AnimatePresence>
                {query ? (
                  <motion.button
                    aria-label="Clear search"
                    className="absolute top-1/2 right-1.5 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full p-2 text-[color:var(--ink)]/50 transition-colors hover:bg-[#77E8EE]/25 hover:text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1FA8B6] focus-visible:ring-offset-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    onClick={() => {
                      setQuery("");
                      setFocusedIndex(-1);
                      inputRef.current?.focus();
                    }}
                    type="button"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </motion.button>
                ) : null}
              </AnimatePresence>
            </motion.div>
          </div>

          <ul
            aria-label={`${placeholder} options`}
            className="max-h-60 overflow-y-auto py-2"
            id={listboxId}
            role="listbox"
          >
            <AnimatePresence mode="popLayout">
              {filteredOptions.length ? (
                filteredOptions.map((option, index) => {
                  const isSelected = value === option.value;
                  const isFocused = focusedIndex === index;
                  return (
                    <motion.li
                      key={option.value}
                      id={`${listboxId}-option-${option.value}`}
                      role="option"
                      aria-selected={isSelected || isFocused}
                      className="block"
                      initial={
                        shouldReduceMotion
                          ? { opacity: 1 }
                          : { opacity: 0, filter: "blur(4px)", x: -10 }
                      }
                      animate={
                        shouldReduceMotion
                          ? { opacity: 1 }
                          : { opacity: 1, filter: "blur(0px)", x: 0 }
                      }
                      exit={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, filter: "blur(4px)", x: -10 }
                      }
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : {
                              type: "spring",
                              stiffness: 400,
                              damping: 28,
                              mass: 0.6,
                              delay: index * 0.02,
                              duration: 0.2,
                            }
                      }
                    >
                      <button
                        aria-label={option.label}
                        className={cn(
                          "flex min-h-11 w-full items-center px-4 py-2 text-left text-sm font-medium text-[color:var(--ink)] transition-colors hover:bg-[#77E8EE]/25 focus-visible:bg-[#77E8EE]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1FA8B6] focus-visible:ring-offset-2",
                          isSelected && "font-semibold text-[color:var(--ink)]",
                          isFocused && "bg-[#77E8EE]/25",
                        )}
                        onClick={() => selectOption(option)}
                        onMouseEnter={() => setFocusedIndex(index)}
                        type="button"
                      >
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                        <AnimatePresence>
                          {isSelected ? (
                            <motion.span
                              className="ml-2 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[color:var(--surface-invert)] text-white"
                              initial={shouldReduceMotion ? {} : { scale: 0 }}
                              animate={shouldReduceMotion ? {} : { scale: 1 }}
                              transition={
                                shouldReduceMotion
                                  ? { duration: 0 }
                                  : {
                                      type: "spring",
                                      stiffness: 400,
                                      damping: 25,
                                      mass: 0.5,
                                      duration: 0.2,
                                    }
                              }
                            >
                              <Check aria-label="Selected" className="h-3 w-3" strokeWidth={3} />
                            </motion.span>
                          ) : null}
                        </AnimatePresence>
                      </button>
                    </motion.li>
                  );
                })
              ) : (
                <motion.li
                  className="px-4 py-8 text-center text-sm text-[color:var(--ink)]/55"
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 400, damping: 25, duration: 0.2 }
                  }
                >
                  {allowCustom && query.trim() ? (
                    <button
                      className="font-semibold text-[color:var(--ink)] underline decoration-[#1FA8B6]/50 underline-offset-4"
                      onClick={() => onChange(query.trim())}
                      type="button"
                    >
                      Use “{query.trim()}”
                    </button>
                  ) : (
                    emptyText
                  )}
                </motion.li>
              )}
            </AnimatePresence>
          </ul>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <div className={cn("relative inline-block w-full", className)}>
      <button
        ref={buttonRef}
        aria-controls={open ? listboxId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={selected ? `${placeholder}: ${selected.label}` : placeholder}
        className={cn(
          "group flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[color:var(--ink)]/15 bg-[color:var(--surface)]/95 px-4 py-2 text-left text-sm font-semibold text-[color:var(--ink)] shadow-[0_1px_2px_rgba(4,19,68,0.04)] transition-[border-color,box-shadow,background-color] duration-150 hover:border-[color:var(--ink)]/35 hover:bg-[color:var(--surface)] focus-visible:border-[#1FA8B6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#77E8EE]/35 disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-[color:var(--ink)]/50",
        )}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        type="button"
      >
        <span className="truncate">{displayLabel}</span>
        <motion.span
          className="shrink-0 text-[color:var(--ink)]/55"
          animate={{ rotate: open ? 180 : 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 400, damping: 25, duration: 0.2 }
          }
        >
          <ChevronDown aria-hidden="true" className="h-4 w-4" />
        </motion.span>
      </button>
      {typeof window !== "undefined" ? createPortal(dropdownContent, document.body) : null}
    </div>
  );
}
