import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
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
          className={cn("h-11 w-full justify-between font-normal", !mode && "text-muted-foreground", className)}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" sideOffset={4} collisionPadding={8}>
        {submenu === "mode" ? (
          <Command shouldFilter={false}>
            <CommandList>
              <CommandGroup>
                <CommandItem onSelect={() => commit("", undefined)}>
                  <Check className={cn("mr-2 h-4 w-4", mode === "" ? "opacity-100" : "opacity-0")} />
                  {MODE_LABELS[""]}
                </CommandItem>
                <CommandItem onSelect={() => commit("online", undefined)}>
                  <Check className={cn("mr-2 h-4 w-4", mode === "online" ? "opacity-100" : "opacity-0")} />
                  {MODE_LABELS.online}
                </CommandItem>
                <CommandItem onSelect={() => commit("either", undefined)}>
                  <Check className={cn("mr-2 h-4 w-4", mode === "either" ? "opacity-100" : "opacity-0")} />
                  {MODE_LABELS.either}
                </CommandItem>
                <CommandItem onSelect={openDistrictSubmenu}>
                  <Check className={cn("mr-2 h-4 w-4", mode === "in_person" ? "opacity-100" : "opacity-0")} />
                  <span className="flex flex-1 items-center justify-between">
                    {MODE_LABELS.in_person}
                    <ChevronRight className="h-4 w-4 opacity-60" />
                  </span>
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <Command shouldFilter>
            <div className="flex items-center gap-1 border-b border-border px-2 py-1">
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSubmenu("mode")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">Choose district</span>
            </div>
            <CommandInput placeholder="Search district..." />
            <CommandList className="max-h-64 overflow-y-auto">
              <CommandEmpty>No district found.</CommandEmpty>
              <CommandGroup>
                <CommandItem onSelect={() => commit("in_person", undefined)}>
                  <Check className={cn("mr-2 h-4 w-4", !district ? "opacity-100" : "opacity-0")} />
                  Any district
                </CommandItem>
                {districts.map((item) => (
                  <CommandItem key={item} value={item} onSelect={() => commit("in_person", item)}>
                    <Check className={cn("mr-2 h-4 w-4", district === item ? "opacity-100" : "opacity-0")} />
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
