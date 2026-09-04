import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Building2,
  ClipboardList,
  GraduationCap,
  Users,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [{ title: "Admin overview — MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminOverview,
});

type CountTable = "tutors" | "tutoring_cases" | "profiles" | "organizations";

async function countRows(table: CountTable): Promise<number> {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

function useTableCount(key: string, table: CountTable) {
  return useQuery({
    queryKey: ["admin", "count", key],
    queryFn: () => countRows(table),
  });
}

type StatCard = {
  label: string;
  table: CountTable;
  key: string;
  note: string;
  icon: LucideIcon;
  to: string;
};

const STAT_CARDS: StatCard[] = [
  {
    label: "Tutors",
    table: "tutors",
    key: "tutors",
    note: "Published & drafts",
    icon: GraduationCap,
    to: "/admin/tutors",
  },
  {
    label: "Cases",
    table: "tutoring_cases",
    key: "cases",
    note: "Matching requests",
    icon: ClipboardList,
    to: "/admin/cases",
  },
  {
    label: "Users",
    table: "profiles",
    key: "users",
    note: "Registered accounts",
    icon: Users,
    to: "/admin/users",
  },
  {
    label: "Organizations",
    table: "organizations",
    key: "organizations",
    note: "Business partners",
    icon: Building2,
    to: "/admin/organizations",
  },
];

function AdminOverview() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Admin overview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything under administration, in one console.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <StatCardView key={card.key} card={card} onOpen={() => navigate({ to: card.to })} />
        ))}
      </div>

      <div className="mt-8">
        <h3 className="pb-3 text-sm font-semibold tracking-tight">Quick actions</h3>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {[
            {
              label: "Review pending cases",
              description: "Approve, match or close case requests",
              to: "/admin/cases",
            },
            {
              label: "Manage tutors",
              description: "Create, edit or unpublish tutor profiles",
              to: "/admin/tutors",
            },
            {
              label: "Manage users & roles",
              description: "Grant admin access or update accounts",
              to: "/admin/users",
            },
            {
              label: "Site settings",
              description: "WhatsApp hotline and global configuration",
              to: "/admin/settings",
            },
          ].map((action) => (
            <button
              key={action.to + action.label}
              type="button"
              onClick={() => navigate({ to: action.to })}
              className="flex w-full items-center gap-4 border-b border-border px-4 py-3 text-left transition-colors duration-150 last:border-b-0 hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{action.label}</p>
                <p className="truncate text-xs text-muted-foreground">{action.description}</p>
              </div>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCardView({ card, onOpen }: { card: StatCard; onOpen: () => void }) {
  const { data, isLoading } = useTableCount(card.key, card.table);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left transition-shadow duration-150 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
        <card.icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-2xl font-bold tracking-tight">
        {isLoading ? "—" : (data ?? 0).toLocaleString()}
      </p>
      <p className="text-xs text-muted-foreground">{card.note}</p>
    </button>
  );
}
