/** MatchMax selector system: the lesson-mode flow shares the reference dropdown’s spring and selection animation language. */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type LessonMode = "" | "online" | "in_person" | "either";

type Props = {
  mode: LessonMode;
  district?: string;
  districts: string[];
  onChange: (next: { mode: LessonMode; district?: string }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

const MODE_KEYS = [{ key: "" }, { key: "online" }, { key: "either" }] as const;

function AnimatedCheck({ selected }: { selected: boolean }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {selected ? (
        <motion.span
          className="ml-auto grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[color:var(--surface-invert)] text-white"
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

export function LessonModeSelect({
  mode,
  district,
  districts,
  onChange,
  placeholder = "Lesson mode",
  disabled = false,
  className,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<"mode" | "district">("mode");
  const shouldReduceMotion = useReducedMotion();

  const modeLabels = useMemo<Record<LessonMode, string>>(
    () => ({
      "": t("search_panel.any_mode"),
      online: t("search_panel.mode_online"),
      in_person: t("search_panel.mode_in_person"),
      either: t("search_panel.mode_open"),
    }),
    [t],
  );
  const anyDistrictLabel = t("search_panel.any_district");

  const triggerLabel = useMemo(() => {
    if (mode === "in_person" && district) return `${modeLabels.in_person} · ${district}`;
    return modeLabels[mode] || placeholder;
  }, [district, mode, modeLabels, placeholder]);

  const openDistrictSubmenu = () => {
    setSubmenu("district");
  };

  const commit = (nextMode: LessonMode, nextDistrict?: string) => {
    onChange({ mode: nextMode, district: nextDistrict });
    setOpen(false);
    setSubmenu("mode");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSubmenu("mode");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            className,
            "group h-11 w-full justify-between rounded-sm border-[color:var(--ink)]/15 bg-[color:var(--surface)] px-4 text-left font-semibold text-[color:var(--ink)] shadow-[0_1px_2px_rgba(4,19,68,0.04)] transition-[border-color,box-shadow,background-color] duration-150 hover:border-[color:var(--ink)]/30 hover:bg-[color:var(--surface)] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
            !mode && "text-[color:var(--ink)]/50",
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <motion.span
            className="ml-2 shrink-0 text-[color:var(--ink)]/55"
            animate={{ rotate: open ? 180 : 0 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 400, damping: 25, duration: 0.2 }
            }
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] overflow-hidden rounded-lg border border-[color:var(--ink)]/10 bg-[color:var(--surface)]/[0.96] p-0 text-[color:var(--ink)] shadow-[0_20px_45px_-18px_rgba(4,19,68,0.28)] backdrop-blur-xl data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1"
        align="start"
        sideOffset={6}
        collisionPadding={8}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={submenu}
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scaleY: 0.88, y: -6 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scaleY: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scaleY: 0.88, y: -6 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 400, damping: 30, mass: 0.8, duration: 0.22 }
            }
          >
            {submenu === "mode" ? (
              <Command shouldFilter={false} className="bg-transparent text-[color:var(--ink)]">
                <CommandList>
                  <CommandGroup>
                    {MODE_KEYS.map((option, index) => (
                      <motion.div
                        key={option.key}
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
                        transition={
                          shouldReduceMotion
                            ? { duration: 0 }
                            : {
                                type: "spring",
                                stiffness: 400,
                                damping: 28,
                                mass: 0.6,
                                delay: index * 0.02,
                              }
                        }
                      >
                        <CommandItem onSelect={() => commit(option.key, undefined)}>
                          {modeLabels[option.key]}
                          <AnimatedCheck selected={mode === option.key} />
                        </CommandItem>
                      </motion.div>
                    ))}
                    <motion.div
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
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 400, damping: 28, mass: 0.6, delay: 0.06 }
                      }
                    >
                      <CommandItem onSelect={openDistrictSubmenu}>
                        <span className="flex flex-1 items-center justify-between">
                          {modeLabels.in_person}
                          <ChevronRight className="h-4 w-4 opacity-60" />
                        </span>
                        <AnimatedCheck selected={mode === "in_person"} />
                      </CommandItem>
                    </motion.div>
                  </CommandGroup>
                </CommandList>
              </Command>
            ) : (
              <Command shouldFilter className="bg-transparent text-[color:var(--ink)]">
                <div className="flex items-center gap-1 border-b border-[color:var(--ink)]/10 px-2.5 py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-md text-[color:var(--ink)] hover:bg-brand-teal/10"
                    onClick={() => setSubmenu("mode")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-bold text-[color:var(--ink)]">
                    {t("search_panel.choose_district")}
                  </span>
                </div>
                <CommandInput placeholder={t("search_panel.search_district")} />
                <CommandList className="max-h-64 overflow-y-auto p-1.5">
                  <CommandEmpty>{t("search_panel.no_district")}</CommandEmpty>
                  <CommandGroup>
                    {["", ...districts].map((item, index) => (
                      <motion.div
                        key={item || "all"}
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
                        transition={
                          shouldReduceMotion
                            ? { duration: 0 }
                            : {
                                type: "spring",
                                stiffness: 400,
                                damping: 28,
                                mass: 0.6,
                                delay: index * 0.02,
                              }
                        }
                      >
                        <CommandItem
                          value={item || anyDistrictLabel}
                          onSelect={() => commit("in_person", item || undefined)}
                        >
                          {item || anyDistrictLabel}
                          <AnimatedCheck selected={district === item} />
                        </CommandItem>
                      </motion.div>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </motion.div>
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  );
}
