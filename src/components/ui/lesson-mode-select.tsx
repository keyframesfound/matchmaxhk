/** MatchMax selector system: the lesson-mode flow shares the searchable dropdown surface and selection language. */
import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
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

const MODE_LABELS: Record<LessonMode, string> = {
  "": "Any lesson mode",
  online: "Online",
  in_person: "In-person",
  either: "Open to discussion",
};

export function LessonModeSelect({
  mode,
  district,
  districts,
  onChange,
  placeholder = "Lesson mode",
  disabled = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<"mode" | "district">("mode");

  const triggerLabel = useMemo(() => {
    if (mode === "in_person" && district) return `In-person · ${district}`;
    return MODE_LABELS[mode] || placeholder;
  }, [district, mode, placeholder]);

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
            "group h-11 w-full justify-between rounded-xl border-[#041344]/15 bg-white/95 px-3.5 text-left font-semibold text-[#041344] shadow-[0_1px_2px_rgba(4,19,68,0.04)] transition-[border-color,box-shadow,background-color] duration-150 hover:border-[#0A245F]/35 hover:bg-white focus-visible:border-[#1FA8B6] focus-visible:ring-4 focus-visible:ring-[#77E8EE]/35",
            !mode && "text-[#041344]/50",
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown
            className={cn(
              "ml-2 h-4 w-4 shrink-0 text-[#041344]/55 transition-transform duration-200",
              open && "rotate-180 text-[#0A245F]",
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] overflow-hidden rounded-xl border border-[#041344]/10 bg-white/[0.96] p-0 text-[#041344] shadow-[0_20px_45px_-18px_rgba(4,19,68,0.28)] backdrop-blur-xl data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1"
        align="start"
        sideOffset={6}
        collisionPadding={8}
      >
        {submenu === "mode" ? (
          <Command shouldFilter={false} className="bg-transparent text-[#041344]">
            <CommandList>
              <CommandGroup>
                <CommandItem onSelect={() => commit("", undefined)}>
                  <Check
                    className={cn("mr-2 h-4 w-4", mode === "" ? "opacity-100" : "opacity-0")}
                  />
                  {MODE_LABELS[""]}
                </CommandItem>
                <CommandItem onSelect={() => commit("online", undefined)}>
                  <Check
                    className={cn("mr-2 h-4 w-4", mode === "online" ? "opacity-100" : "opacity-0")}
                  />
                  {MODE_LABELS.online}
                </CommandItem>
                <CommandItem onSelect={() => commit("either", undefined)}>
                  <Check
                    className={cn("mr-2 h-4 w-4", mode === "either" ? "opacity-100" : "opacity-0")}
                  />
                  {MODE_LABELS.either}
                </CommandItem>
                <CommandItem onSelect={openDistrictSubmenu}>
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      mode === "in_person" ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex flex-1 items-center justify-between">
                    {MODE_LABELS.in_person}
                    <ChevronRight className="h-4 w-4 opacity-60" />
                  </span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <Command shouldFilter className="bg-transparent text-[#041344]">
            <div className="flex items-center gap-1 border-b border-[#041344]/10 px-2.5 py-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-[#041344] hover:bg-[#77E8EE]/25"
                onClick={() => setSubmenu("mode")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-bold text-[#041344]">Choose district</span>
            </div>
            <CommandInput placeholder="Search district..." />
            <CommandList className="max-h-64 overflow-y-auto p-1.5">
              <CommandEmpty>No district found.</CommandEmpty>
              <CommandGroup>
                <CommandItem onSelect={() => commit("in_person", undefined)}>
                  <Check className={cn("mr-2 h-4 w-4", !district ? "opacity-100" : "opacity-0")} />
                  Any district
                </CommandItem>
                {districts.map((item) => (
                  <CommandItem key={item} value={item} onSelect={() => commit("in_person", item)}>
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        district === item ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {item}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
