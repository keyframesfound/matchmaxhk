import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CalendarClock, Check, Columns2, ListChecks } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/useAuth";
import {
  CASE_GENDER_LABEL,
  CASE_MODE_LABEL,
  CASE_START_LABEL,
  formatCaseBudget,
  formatCaseSchedule,
  formatStudentLevel,
} from "@/features/cases/display";
import type { PublicCaseBoardItem } from "@/lib/cases.functions";
import { supabase } from "@/integrations/supabase/client";
import { setCompareBarVisible } from "@/lib/compare-bar";

export const MAX_CASE_COMPARE = 4;

const COMPARE_STORAGE_KEY = "matchmax:compared-cases";

export const comparedCasesQueryKey = (userId: string | undefined) =>
  ["compared-cases", userId] as const;

function readGuestCompareIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

function writeGuestCompareIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage unavailable (private mode etc.) — compare still works in-session.
  }
}

async function fetchComparedCaseIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("compared_cases")
    .select("case_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.case_id);
}

// Signed-in users get their selection saved on their account; guests fall back
// to localStorage so the board still works without an account.
export function useComparedCaseIds() {
  const { user } = useAuth();

  return useQuery({
    queryKey: comparedCasesQueryKey(user?.id),
    queryFn: () => (user ? fetchComparedCaseIds(user.id) : Promise.resolve(readGuestCompareIds())),
    staleTime: 60_000,
  });
}

function useComparedCaseMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ caseId, selected }: { caseId: string; selected: boolean }) => {
      if (user) {
        if (selected) {
          const { error } = await supabase
            .from("compared_cases")
            .insert({ user_id: user.id, case_id: caseId });
          if (error) throw error;
          return;
        }
        const { error } = await supabase
          .from("compared_cases")
          .delete()
          .eq("user_id", user.id)
          .eq("case_id", caseId);
        if (error) throw error;
        return;
      }

      const ids = readGuestCompareIds();
      const next = selected
        ? Array.from(new Set([...ids, caseId]))
        : ids.filter((id) => id !== caseId);
      writeGuestCompareIds(next);
    },
    onSuccess: (_data, { caseId, selected }) => {
      queryClient.setQueryData<string[]>(comparedCasesQueryKey(user?.id), (ids = []) =>
        selected ? Array.from(new Set([...ids, caseId])) : ids.filter((id) => id !== caseId),
      );
      void queryClient.invalidateQueries({ queryKey: ["compared-cases"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function CaseCompareToggle({ caseId }: { caseId: string }) {
  const compareIdsQuery = useComparedCaseIds();
  const mutation = useComparedCaseMutation();
  const selected = compareIdsQuery.data?.includes(caseId) ?? false;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-pressed={selected}
      aria-label={selected ? "Remove request from comparison" : "Add request to comparison"}
      title={selected ? "Remove from comparison" : "Compare request"}
      disabled={mutation.isPending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        mutation.mutate({ caseId, selected: !selected });
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className="h-10 w-8 shrink-0 rounded-sm border-0 bg-transparent p-0 text-[color:var(--ink)] shadow-none hover:bg-[color:var(--foreground)]/[0.06] hover:text-[color:var(--ink)]"
    >
      {selected ? (
        <Check className="h-5 w-5" strokeWidth={2.8} aria-hidden="true" />
      ) : (
        <Columns2 className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
      )}
    </Button>
  );
}

function CaseCompareBar({
  count,
  onOpenCompare,
  onClear,
  className,
}: {
  count: number;
  onOpenCompare: () => void;
  onClear: () => void;
  className?: string;
}) {
  return (
    <div
      className={
        className ??
        "fixed bottom-20 left-1/2 z-40 w-[min(92vw,30rem)] -translate-x-1/2 sm:bottom-6"
      }
    >
      <div className="flex items-center justify-between gap-3 rounded-full border border-[color:var(--foreground)]/15 bg-[color:var(--surface)] px-4 py-2.5 shadow-[0_16px_40px_rgba(4,19,68,0.18)]">
        <div className="flex min-w-0 items-center gap-2">
          <ListChecks
            className="h-4 w-4 shrink-0 text-[color:var(--muted-foreground)]"
            aria-hidden="true"
          />
          <p className="truncate text-sm font-semibold text-[color:var(--ink)]">
            {count} of {MAX_CASE_COMPARE} selected
            {count === 1 ? " — pick at least 2" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            className="h-9 rounded-full px-4 text-[13px] font-bold"
            disabled={count < 2}
            onClick={onOpenCompare}
          >
            Compare
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 rounded-full px-3 text-[13px] font-bold text-[color:var(--ink)] hover:bg-[color:var(--surface-subtle)]"
            onClick={onClear}
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}

function CaseCompareDialog({
  open,
  onOpenChange,
  cases,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cases: PublicCaseBoardItem[];
}) {
  const columns = `minmax(7.5rem, 0.9fr) repeat(${cases.length}, minmax(10.5rem, 1.4fr))`;
  const rows: { label: string; render: (item: PublicCaseBoardItem) => React.ReactNode }[] = [
    {
      label: "Subjects",
      render: (item) => (
        <p className="text-[13px] font-semibold leading-snug text-[color:var(--ink)]">
          {item.subjects.filter(Boolean).join(", ") || "Not specified"}
        </p>
      ),
    },
    {
      label: "Level",
      render: (item) => (
        <p className="text-[13px] font-semibold text-[color:var(--ink)]">
          {formatStudentLevel(item.studentLevel) || item.studentLevel}
        </p>
      ),
    },
    {
      label: "Budget",
      render: (item) => (
        <p className="text-[13px] font-semibold text-[color:var(--ink)]">
          {formatCaseBudget(item.budgetMin, item.budgetMax)}
        </p>
      ),
    },
    {
      label: "Schedule",
      render: (item) => (
        <p className="text-[13px] font-semibold text-[color:var(--ink)]">
          {formatCaseSchedule(item.sessionsPerWeek, item.sessionLengthMinutes)}
        </p>
      ),
    },
    {
      label: "Lesson mode",
      render: (item) => (
        <p className="text-[13px] font-semibold text-[color:var(--ink)]">
          {CASE_MODE_LABEL[item.mode] ?? item.mode}
          {item.district ? ` · ${item.district}` : ""}
        </p>
      ),
    },
    {
      label: "Curriculum",
      render: (item) => (
        <p className="text-[13px] font-semibold text-[color:var(--ink)]">
          {item.examSystem && item.examSystem !== "Not sure yet" ? item.examSystem : "Flexible"}
        </p>
      ),
    },
    {
      label: "Tutor gender",
      render: (item) => (
        <p className="text-[13px] font-semibold text-[color:var(--ink)]">
          {CASE_GENDER_LABEL[item.preferredGender] ?? "No preference"}
        </p>
      ),
    },
    {
      label: "Start",
      render: (item) => (
        <p className="text-[13px] font-semibold text-[color:var(--ink)]">
          {CASE_START_LABEL[item.startTiming ?? ""] ?? "Flexible"}
        </p>
      ),
    },
    {
      label: "Posted",
      render: (item) => (
        <p className="text-[13px] font-semibold text-[color:var(--ink)]">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </p>
      ),
    },
    {
      label: "",
      render: (item) => (
        <Button asChild size="sm" className="h-9 rounded-sm px-4 text-[13px] font-bold shadow-none">
          <Link to="/tutor-requests/$caseCode" params={{ caseCode: item.caseCode }}>
            View details
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-6xl overflow-y-auto rounded-sm p-0 sm:rounded-sm">
        <DialogHeader className="border-b border-border px-5 py-4 text-left sm:px-6">
          <DialogTitle className="text-lg font-bold tracking-tight text-[color:var(--ink)]">
            Compare requests
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Side-by-side comparison of your shortlisted cases.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto px-5 pb-6 sm:px-6">
          <div className="min-w-[36rem]" style={{ display: "grid", gridTemplateColumns: columns }}>
            <div />
            {cases.map((item) => (
              <div key={item.id} className="px-3 py-3 text-center">
                <span className="inline-block rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
                  {item.caseCode}
                </span>
                <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug text-[color:var(--ink)]">
                  {item.subjects.filter(Boolean).slice(0, 2).join(", ") || item.title}
                </p>
              </div>
            ))}
            {rows.map(({ label, render }) => (
              <div key={label || "actions"} className="contents">
                <div className="border-t border-border/70 px-2 py-3 text-[11px] font-medium text-muted-foreground">
                  {label}
                </div>
                {cases.map((item) => (
                  <div
                    key={item.id}
                    className="border-t border-border/70 px-3 py-3 align-top text-left"
                  >
                    {render(item)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useCaseCompare(items: PublicCaseBoardItem[]) {
  const compareIdsQuery = useComparedCaseIds();
  const mutation = useComparedCaseMutation();
  const [compareOpen, setCompareOpen] = useState(false);

  const compareIds = useMemo(
    () => (compareIdsQuery.data ?? []).filter((id) => items.some((item) => item.id === id)),
    [compareIdsQuery.data, items],
  );

  const compareCases = useMemo(
    () =>
      compareIds
        .map((id) => items.find((item) => item.id === id))
        .filter((item): item is PublicCaseBoardItem => Boolean(item)),
    [compareIds, items],
  );

  const toggleCompare = (item: PublicCaseBoardItem) => {
    const selected = (compareIdsQuery.data ?? []).includes(item.id);
    if (!selected && (compareIdsQuery.data ?? []).length >= MAX_CASE_COMPARE) {
      toast.error(`You can compare up to ${MAX_CASE_COMPARE} cases.`);
      return;
    }
    mutation.mutate({ caseId: item.id, selected: !selected });
  };

  const clearCompare = () => {
    const ids = compareIdsQuery.data ?? [];
    for (const caseId of ids) mutation.mutate({ caseId, selected: false });
  };

  const compareBarVisible = compareCases.length > 0 && !compareOpen;

  useEffect(() => {
    setCompareBarVisible("case-compare", compareBarVisible);
    return () => setCompareBarVisible("case-compare", false);
  }, [compareBarVisible]);

  return {
    compareIds,
    compareCases,
    toggleCompare,
    compareOpen,
    setCompareOpen,
    clearCompare,
  };
}

export { CaseCompareBar, CaseCompareDialog };
