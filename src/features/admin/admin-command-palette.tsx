import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  Building2,
  ClipboardList,
  ExternalLink,
  Flag,
  Gift,
  GraduationCap,
  Image as ImageIcon,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

interface PaletteEntry {
  label: string;
  to: string;
  icon: LucideIcon;
  search?: Record<string, string>;
}

const GO_TO: PaletteEntry[] = [
  { label: "Overview", to: "/admin", icon: LayoutDashboard },
  { label: "Tutors", to: "/admin/tutors", icon: GraduationCap },
  { label: "Grade review", to: "/admin/grades", icon: ShieldCheck },
  { label: "Join requests", to: "/admin/join-requests", icon: UserPlus },
  { label: "Cases", to: "/admin/cases", icon: ClipboardList },
  { label: "Referrals", to: "/admin/referrals", icon: Gift },
  { label: "Study materials", to: "/admin/materials", icon: BookOpen },
  { label: "Reports", to: "/admin/reports", icon: Flag },
  { label: "Trust & safety", to: "/admin/trust-safety", icon: ShieldAlert },
  { label: "Users", to: "/admin/users", icon: Users },
  { label: "Organizations", to: "/admin/organizations", icon: Building2 },
  { label: "R2 images", to: "/admin/r2", icon: ImageIcon },
  { label: "Settings", to: "/admin/settings", icon: Settings },
];

const ACTIONS: PaletteEntry[] = [
  { label: "Add tutor", to: "/admin/tutors", icon: Plus, search: { create: "1" } },
];

/**
 * Cmd/Ctrl+K palette for the admin console: jump to any desk or fire a
 * quick action without the sidebar. Copy stays hardcoded English, matching
 * the console's nav labels.
 */
export function AdminCommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = (entry: PaletteEntry) => {
    setOpen(false);
    void navigate({ to: entry.to, search: entry.search ?? {} });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Meta+K Control+K"
      >
        <Search className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        <span className="hidden lg:inline">Search</span>
        <kbd className="hidden rounded-[var(--radius-control)] border border-border bg-[color:var(--surface-subtle)] px-1.5 py-px font-sans text-[11px] font-normal text-muted-foreground lg:inline">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages and actions" />
        <CommandList>
          <CommandEmpty>Nothing matches that search.</CommandEmpty>
          <CommandGroup heading="Go to">
            {GO_TO.map((entry) => (
              <CommandItem
                key={entry.to}
                value={`${entry.label} ${entry.to}`}
                onSelect={() => go(entry)}
              >
                <entry.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                {entry.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            {ACTIONS.map((entry) => (
              <CommandItem key={entry.label} value={entry.label} onSelect={() => go(entry)}>
                <entry.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                {entry.label}
              </CommandItem>
            ))}
            <CommandItem
              value="view site open public site"
              onSelect={() => {
                setOpen(false);
                window.open("/", "_blank", "noopener");
              }}
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              View site
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
