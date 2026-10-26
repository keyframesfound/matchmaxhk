import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { Ban, Clock, Download, Flame, Inbox, MessageCircle, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  ConsoleTable,
  ConsoleTableBody,
  ConsoleTableEmpty,
  ConsoleTableHead,
  ConsoleTableSkeletonRows,
  ConsoleTd,
  ConsoleTh,
} from "@/components/ui/console-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";
import { CaseDetailView } from "@/features/cases/admin/CaseDetailView";
import { SorDeskTools } from "@/features/cases/admin/sor-desk";
import {
  ADMIN_CASE_SELECT_COLUMNS,
  CASE_STATUSES,
  DESK_LANGUAGE_LABEL,
  MODE_LABEL,
  PRIORITY_PILL_CLASS,
  START_LABEL,
  STATUS_LABEL,
  STATUS_PILL_CLASS,
  caseBudgetHkdBounds,
  whatsappUrl,
  type CaseRow,
  type CaseStatus,
} from "@/features/cases/admin/shared";
import {
  deskBucketForTier,
  normalizePriorityTier,
  PRIORITY_TIERS,
  type PriorityTier,
} from "@/features/cases/priority-tier";
import {
  findCasesByTutorCode,
  type TutorCodeCaseHit,
} from "@/features/cases/desk-search.functions";
import { RiskFlagBadge } from "@/features/admin/risk-flag-badge";
import { listRiskFlags, type RiskFlagRow } from "@/features/admin/risk-flags.functions";
import { normalizeRiskFlag } from "@/features/admin/risk-flags";
import {
  applyCaseFilters,
  caseFilterOptions,
  caseFiltersToSearch,
  CASE_CREATED_PRESETS,
  CASE_MODE_VALUES,
  CASE_RATE_BANDS,
  CLEAR_ALL,
  isDefaultFilters,
  parseCaseFilters,
  type CaseFilters,
  type CaseFiltersSearch,
} from "@/features/admin/case-filters";

export const Route = createFileRoute("/_authenticated/admin/cases")({
  head: () => ({
    meta: [
      { title: "Case Requests, MatchMax Admin" },
      { name: "description", content: "Handle incoming case requests on MatchMax." },
      { name: "robots", content: "noindex" },
    ],
  }),
  // Issue #71: filter state lives in the URL. validateSearch stores the
  // serialized (URL-shaped) form, parse into defaults-filled filters in
  // the component. The parse layer tolerates JSON-decoded params
  // (?status=1 → number, ?status=true → boolean) and drops junk.
  validateSearch: (search: Record<string, unknown>): CaseFiltersSearch =>
    caseFiltersToSearch(parseCaseFilters(search)),
  component: AdminCases,
});

function AdminCases() {
  const { hasAnyRole, loading } = useAuth();
  const { t } = useTranslation();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const searchParams = Route.useSearch();
  const filters = useMemo(() => parseCaseFilters(searchParams), [searchParams]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [confirmBatchClose, setConfirmBatchClose] = useState(false);

  /** One writer for every filter control, lands in the URL, clean defaults. */
  const setFilters = (patch: Partial<CaseFilters>) => {
    navigate({
      search: caseFiltersToSearch({ ...filters, ...patch }),
      replace: true,
    });
  };

  const clearFilters = () => {
    navigate({ search: caseFiltersToSearch(CLEAR_ALL), replace: true });
  };

  useEffect(() => {
    if (!loading && !hasAnyRole(["admin", "super_admin", "staff"])) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, hasAnyRole, navigate]);

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["admin", "cases"],
    queryFn: async () => {
      // Explicit columns: the table grants authenticated a column-level SELECT
      // (admin-only fields, internal_note, whatsapp_group_url, hourly_rate_hkd
      //, are excluded DB-side), so select(*) would fail with permission denied.
      // The list lives in ADMIN_CASE_SELECT_COLUMNS (shared.ts) so the
      // tutor-code search (#55) selects the identical shape.
      const { data, error } = await supabase
        .from("tutoring_cases")
        .select(ADMIN_CASE_SELECT_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as unknown as CaseRow[];
    },
  });

  const invalidateCases = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "cases"] });
  };

  // Issue #438: manual priority dropdown — the ONLY writer of priority_tier.
  // No LLM, no automation; a human agent picks the tier per case.
  const priorityMutation = useMutation({
    mutationFn: async ({ id, tier }: { id: string; tier: PriorityTier }) => {
      const { error } = await supabase
        .from("tutoring_cases")
        .update({ priority_tier: tier } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("desk.priority_updated"));
      queryClient.invalidateQueries({ queryKey: ["admin", "cases"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Issue #438 desk counts: the Active tab shows UNASSIGNED+P1+P2, Hold the
  // P3+P4 tail — agents see how much is waiting in each bucket before
  // switching views.
  const deskCounts = useMemo(() => {
    const counts = { active: 0, hold: 0 };
    for (const row of cases) {
      counts[deskBucketForTier(row.priority_tier)] += 1;
    }
    return counts;
  }, [cases]);

  const filterOptions = useMemo(() => caseFilterOptions(cases), [cases]);

  const filtered = useMemo(() => applyCaseFilters(cases, filters), [cases, filters]);

  // Issue #441: staff risk flags for the desk rows. Same query key the
  // detail editor writes through, so a save in CaseDetailView refreshes
  // these badges (and vice versa).
  const riskFlagsQuery = useQuery({
    queryKey: ["admin", "risk-flags", "case"],
    queryFn: () => listRiskFlags({ data: { entity: "case" } }),
  });
  const riskFlagByCaseId = useMemo(() => {
    const map = new Map<string, RiskFlagRow>();
    for (const row of riskFlagsQuery.data ?? []) {
      if (row.case_id) map.set(row.case_id, row);
    }
    return map;
  }, [riskFlagsQuery.data]);
  // Optional V1 chip (issue #441): hide BLOCKED cases from the skim, OFF by
  // default. Session-only — BLOCKED rows still exist and stay listed.
  const [hideBlocked, setHideBlocked] = useState(false);
  const hasActiveFilters = !isDefaultFilters(filters);

  // Issue #55: staff search by tutor code. The desk's q filter only sees
  // case columns, so a tutor code runs a separate server fn whose hits are
  // UNIONed ahead of the filtered list (dedupe by id). Kept as local state
  //, one ad-hoc lookup input; URL persistence buys nothing here.
  const [tutorCodeQuery, setTutorCodeQuery] = useState("");
  const [tutorCodeDebounced, setTutorCodeDebounced] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setTutorCodeDebounced(tutorCodeQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [tutorCodeQuery]);
  const tutorCodeSearch = useQuery({
    queryKey: ["admin", "cases", "tutor-code", tutorCodeDebounced],
    queryFn: () => findCasesByTutorCode({ data: { query: tutorCodeDebounced } }),
    enabled: tutorCodeDebounced.length > 0,
  });
  type AdminDeskRow = CaseRow & {
    matchedTutor?: TutorCodeCaseHit["matchedTutor"];
  };
  const tutorCodeHits = useMemo<AdminDeskRow[]>(() => {
    if (!tutorCodeDebounced) return [];
    return (tutorCodeSearch.data?.items ?? []) as TutorCodeCaseHit[] as AdminDeskRow[];
  }, [tutorCodeDebounced, tutorCodeSearch.data]);
  const displayed = useMemo<AdminDeskRow[]>(() => {
    // Issue #441: the optional Hide-BLOCKED chip (off by default) drops
    // blocked rows from the skim only — the flag is never a data filter.
    const blocked = (rows: AdminDeskRow[]) =>
      hideBlocked
        ? rows.filter(
            (row) => normalizeRiskFlag(riskFlagByCaseId.get(row.id)?.risk_flag) !== "BLOCKED",
          )
        : rows;
    if (tutorCodeHits.length === 0) return blocked(filtered);
    const hitIds = new Set(tutorCodeHits.map((row) => row.id));
    return blocked([...tutorCodeHits, ...filtered.filter((row) => !hitIds.has(row.id))]);
  }, [filtered, hideBlocked, riskFlagByCaseId, tutorCodeHits]);

  const rateBandLabels: Record<CaseFilters["rateBand"], string> = {
    all: t("caseFilters.rate_any", { defaultValue: "Any rate" }),
    lt100: t("caseFilters.rate_under_100", { defaultValue: "Under HK$100" }),
    "100-200": t("caseFilters.rate_100_200", { defaultValue: "HK$100–200" }),
    "200-300": t("caseFilters.rate_200_300", { defaultValue: "HK$200–300" }),
    gte300: t("caseFilters.rate_300_plus", { defaultValue: "HK$300 or more" }),
  };

  const createdLabels: Record<CaseFilters["created"], string> = {
    all: t("caseFilters.created_any", { defaultValue: "Any date" }),
    "7d": t("caseFilters.created_7d", { defaultValue: "Last 7 days" }),
    "30d": t("caseFilters.created_30d", { defaultValue: "Last 30 days" }),
  };

  const openCase = openId ? (cases.find((row) => row.id === openId) ?? null) : null;

  const batchStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: CaseStatus }) => {
      // Issue #412: held cases are locked, batch escalations skip them and
      // report the count instead of silently moving a locked request.
      const held = new Set(
        cases.filter((row) => row.status === "compliance_hold").map((row) => row.id),
      );
      const targetIds = ids.filter(
        (id) => !(held.has(id) && (status === "contacted" || status === "matched")),
      );
      if (targetIds.length === 0) {
        throw new Error("Compliance hold: re-screen held cases individually before escalating.");
      }
      const patch: Record<string, unknown> = { status };
      if (status === "contacted") patch.last_contacted_at = new Date().toISOString();
      const { error } = await supabase
        .from("tutoring_cases")
        .update(patch as never)
        .in("id", targetIds);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast.success(
        `${STATUS_LABEL[variables.status]} applied to ${variables.ids.length} case${variables.ids.length === 1 ? "" : "s"}`,
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "cases"] });
      setSelectedIds(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tutoring_cases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Case deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "cases"] });
      setDeletingId(null);
      setOpenId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const batchRemoveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("tutoring_cases").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_data, ids) => {
      toast.success(`Deleted ${ids.length} case${ids.length === 1 ? "" : "s"}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "cases"] });
      setSelectedIds(new Set());
      setConfirmBatchDelete(false);
      setOpenId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allFilteredSelected =
    displayed.length > 0 && displayed.every((row) => selectedIds.has(row.id));

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        displayed.forEach((row) => next.delete(row.id));
      } else {
        displayed.forEach((row) => next.add(row.id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const downloadCsv = () => {
    const rows =
      selectedIds.size > 0 ? displayed.filter((row) => selectedIds.has(row.id)) : displayed;
    if (rows.length === 0) return;
    const columns: { label: string; value: (row: (typeof cases)[number]) => string }[] = [
      { label: "Case code", value: (row) => row.case_code },
      { label: "Title", value: (row) => row.title },
      { label: "Status", value: (row) => STATUS_LABEL[row.status] },
      { label: "Desk language", value: (row) => row.desk_language },
      { label: "Contact name", value: (row) => row.contact_name },
      { label: "Contact phone", value: (row) => row.contact_phone },
      { label: "Subjects", value: (row) => (row.subjects ?? []).join("; ") },
      { label: "Student level", value: (row) => row.student_level },
      { label: "District", value: (row) => row.district ?? "" },
      { label: "Lesson mode", value: (row) => MODE_LABEL[row.mode] ?? row.mode },
      {
        label: "Budget min (HKD)",
        value: (row) => String(caseBudgetHkdBounds(row).min ?? ""),
      },
      {
        label: "Budget max (HKD)",
        value: (row) => String(caseBudgetHkdBounds(row).max ?? ""),
      },
      { label: "Start timing", value: (row) => START_LABEL[row.start_timing ?? ""] ?? "" },
      { label: "Tags", value: (row) => (row.tags ?? []).join("; ") },
      { label: "Received", value: (row) => new Date(row.created_at).toISOString() },
    ];
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csv = [
      columns.map((column) => escape(column.label)).join(","),
      ...rows.map((row) => columns.map((column) => escape(column.value(row))).join(",")),
    ].join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `matchmax-case-requests-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <main className="flex-1 bg-[color:var(--surface)]">
        <div className="mx-auto max-w-[1536px] px-4 py-8 sm:px-6 lg:px-8">
          {openCase ? (
            <CaseDetailView
              caseRow={openCase}
              allTags={filterOptions.tags}
              onBack={() => setOpenId(null)}
            />
          ) : (
            <div className="space-y-8">
              {/* SoR tools (#201): new case, CSV import, unpaid queue */}
              <SorDeskTools />

              {/* Issue #438 desk split (CEO lock): Active Desk = UNASSIGNED +
                  P1 + P2 by default; Hold/Review shows only P3 + P4. The
                  desk filter rides the URL (?desk=hold) like every #71
                  filter. */}
              <div className="flex items-center gap-1 rounded-xl border border-[color:var(--ink)]/10 p-1">
                {(["active", "hold"] as const).map((bucket) => (
                  <Button
                    key={bucket}
                    type="button"
                    size="sm"
                    variant={filters.desk === bucket ? "default" : "ghost"}
                    className="h-9 px-4 text-sm font-bold"
                    aria-pressed={filters.desk === bucket}
                    onClick={() => setFilters({ desk: bucket })}
                  >
                    {bucket === "active" ? t("desk.active") : t("desk.hold")}
                    <span
                      className={cn(
                        "ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold",
                        filters.desk === bucket
                          ? "bg-white/25 text-white"
                          : "bg-[color:var(--ink)]/[0.06] text-muted-foreground",
                      )}
                    >
                      {deskCounts[bucket]}
                    </span>
                  </Button>
                ))}
              </div>

              {/* Header Bar */}
              <div className="flex flex-col gap-4 border-b border-[color:var(--ink)]/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight text-[color:var(--ink)] sm:text-4xl">
                      Case Requests
                    </h1>
                    <span className="rounded-full bg-[color:var(--ink)]/5 px-2.5 py-0.5 text-xs font-medium tabular-nums text-[color:var(--ink)]">
                      {filtered.length === cases.length
                        ? cases.length
                        : `${filtered.length} of ${cases.length}`}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Requests submitted on the site. Open a case to add notes, tags, and matched
                    tutors.
                  </p>
                </div>
              </div>

              {/* Filters & Search, issue #71: URL-persisted structured filters */}
              <div className="space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="relative w-full lg:max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by code, contact, subject, tag..."
                      value={filters.q}
                      onChange={(e) => setFilters({ q: e.target.value })}
                      className="h-10 border-[color:var(--ink)]/15 bg-[color:var(--surface)] pl-9"
                    />
                  </div>
                  {/* Issue #55: find cases by the MATCHED TUTOR's code, the
                      q filter only sees case columns. */}
                  <div className="relative w-full lg:max-w-[220px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={t("caseDesk.tutor_code_placeholder", {
                        defaultValue: "Search by tutor code…",
                      })}
                      aria-label={t("caseDesk.tutor_code_label", { defaultValue: "Tutor code" })}
                      value={tutorCodeQuery}
                      onChange={(e) => setTutorCodeQuery(e.target.value)}
                      className="h-10 border-[color:var(--ink)]/15 bg-[color:var(--surface)] pl-9"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={filters.status}
                      onValueChange={(v) => setFilters({ status: v as CaseFilters["status"] })}
                    >
                      <SelectTrigger className="h-10 w-36 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {CASE_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {filterOptions.tags.length > 0 ? (
                      <Select value={filters.tag} onValueChange={(v) => setFilters({ tag: v })}>
                        <SelectTrigger className="h-10 w-36 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All tags</SelectItem>
                          {filterOptions.tags.map((tag) => (
                            <SelectItem key={tag} value={tag}>
                              {tag}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                    {/* Issue #441: optional skim filter, OFF by default — a
                        BLOCKED case only leaves the list when CS asks. */}
                    <Button
                      size="sm"
                      variant={hideBlocked ? "secondary" : "ghost"}
                      aria-pressed={hideBlocked}
                      onClick={() => setHideBlocked((v) => !v)}
                      className="h-10 text-muted-foreground hover:text-[color:var(--ink)]"
                    >
                      <Ban className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      {t("risk.hide_blocked", { defaultValue: "Hide BLOCKED" })}
                    </Button>
                    {hasActiveFilters ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-10 text-muted-foreground hover:text-[color:var(--ink)]"
                        onClick={clearFilters}
                      >
                        <X className="mr-1.5 h-3.5 w-3.5" />
                        {t("caseFilters.clear_filters", { defaultValue: "Clear filters" })}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={filters.curriculum}
                    onValueChange={(v) => setFilters({ curriculum: v })}
                  >
                    <SelectTrigger className="h-10 w-40 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("caseFilters.all_curricula", { defaultValue: "All curricula" })}
                      </SelectItem>
                      {filterOptions.curricula.map((curriculum) => (
                        <SelectItem key={curriculum} value={curriculum}>
                          {curriculum}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filterOptions.subjects.length > 0 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="h-10 border-[color:var(--ink)]/15 bg-[color:var(--surface)] px-3 text-sm font-normal text-[color:var(--ink)]"
                        >
                          {filters.subjects.length === 0
                            ? t("caseFilters.subjects_all", { defaultValue: "All subjects" })
                            : t("caseFilters.subjects_count", {
                                defaultValue: "Subjects ({{count}})",
                                count: filters.subjects.length,
                              })}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-72 w-56 overflow-y-auto">
                        {filterOptions.subjects.map((subject) => (
                          <DropdownMenuCheckboxItem
                            key={subject}
                            checked={filters.subjects.includes(subject)}
                            onCheckedChange={() =>
                              setFilters({
                                subjects: filters.subjects.includes(subject)
                                  ? filters.subjects.filter((s) => s !== subject)
                                  : [...filters.subjects, subject],
                              })
                            }
                            onSelect={(e) => e.preventDefault()}
                          >
                            {subject}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                  <Select value={filters.level} onValueChange={(v) => setFilters({ level: v })}>
                    <SelectTrigger className="h-10 w-44 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("caseFilters.all_levels", { defaultValue: "All levels" })}
                      </SelectItem>
                      {filterOptions.levels.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filters.mode}
                    onValueChange={(v) => setFilters({ mode: v as CaseFilters["mode"] })}
                  >
                    <SelectTrigger className="h-10 w-36 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("caseFilters.all_modes", { defaultValue: "All modes" })}
                      </SelectItem>
                      {CASE_MODE_VALUES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {MODE_LABEL[mode] ?? mode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filters.district}
                    onValueChange={(v) => setFilters({ district: v })}
                  >
                    <SelectTrigger className="h-10 w-36 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("caseFilters.all_districts", { defaultValue: "All areas" })}
                      </SelectItem>
                      {filterOptions.districts.map((district) => (
                        <SelectItem key={district} value={district}>
                          {district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filters.rateBand}
                    onValueChange={(v) => setFilters({ rateBand: v as CaseFilters["rateBand"] })}
                  >
                    <SelectTrigger className="h-10 w-40 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CASE_RATE_BANDS.map((band) => (
                        <SelectItem key={band.id} value={band.id}>
                          {rateBandLabels[band.id]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filters.created}
                    onValueChange={(v) => setFilters({ created: v as CaseFilters["created"] })}
                  >
                    <SelectTrigger className="h-10 w-36 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CASE_CREATED_PRESETS.map((preset) => (
                        <SelectItem key={preset} value={preset}>
                          {createdLabels[preset]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Batch actions */}
              {selectedIds.size > 0 ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--foreground)]/15 bg-[color:var(--foreground)]/[0.04] px-4 py-3">
                  <span className="text-sm font-bold text-[color:var(--ink)]">
                    {selectedIds.size} selected
                  </span>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={downloadCsv}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download CSV
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={batchStatusMutation.isPending}
                      onClick={() =>
                        batchStatusMutation.mutate({ ids: [...selectedIds], status: "contacted" })
                      }
                    >
                      <Clock className="mr-1.5 h-3.5 w-3.5" />
                      Mark contacted
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={batchStatusMutation.isPending}
                      onClick={() =>
                        batchStatusMutation.mutate({ ids: [...selectedIds], status: "matched" })
                      }
                    >
                      Mark matched
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={batchStatusMutation.isPending}
                      onClick={() => setConfirmBatchClose(true)}
                    >
                      Close
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={batchRemoveMutation.isPending}
                      onClick={() => setConfirmBatchDelete(true)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Clear selection"
                      onClick={() => setSelectedIds(new Set())}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null}

              <ConsoleTable tableClassName="text-left">
                <ConsoleTableHead>
                  <tr>
                    <ConsoleTh>
                      <Checkbox
                        className="rounded-[4px]"
                        checked={allFilteredSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Select all cases"
                      />
                    </ConsoleTh>
                    <ConsoleTh>Case</ConsoleTh>
                    <ConsoleTh>Parent Contact</ConsoleTh>
                    <ConsoleTh>Subjects & Level</ConsoleTh>
                    <ConsoleTh>Format & District</ConsoleTh>
                    <ConsoleTh>Budget</ConsoleTh>
                    <ConsoleTh>Priority</ConsoleTh>
                    <ConsoleTh>Status</ConsoleTh>
                    <ConsoleTh>Tags</ConsoleTh>
                    <ConsoleTh align="right">Actions</ConsoleTh>
                  </tr>
                </ConsoleTableHead>
                <ConsoleTableBody>
                  {isLoading && <ConsoleTableSkeletonRows columns={10} />}

                  {!isLoading && displayed.length === 0 && (
                    <ConsoleTableEmpty
                      colSpan={10}
                      icon={Inbox}
                      title="No case requests found"
                      description={
                        hasActiveFilters
                          ? t("caseFilters.empty_filtered", {
                              defaultValue: "Try adjusting your filters",
                            })
                          : filters.desk === "active"
                            ? t("desk.empty.active")
                            : "New submissions from the case request form will appear here."
                      }
                      action={
                        hasActiveFilters ? (
                          <Button size="sm" variant="outline" onClick={clearFilters}>
                            {t("caseFilters.clear_filters", { defaultValue: "Clear filters" })}
                          </Button>
                        ) : undefined
                      }
                    />
                  )}

                  {displayed.map((row) => {
                    const budgetBounds = caseBudgetHkdBounds(row);
                    // Issue #441: staff risk flag for this case (absent = NONE).
                    const flagRow = riskFlagByCaseId.get(row.id);
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          "transition-colors hover:bg-[color:var(--surface-subtle)]/40",
                          selectedIds.has(row.id) && "bg-[color:var(--foreground)]/[0.04]",
                        )}
                      >
                        <ConsoleTd>
                          <Checkbox
                            className="rounded-[4px]"
                            checked={selectedIds.has(row.id)}
                            onCheckedChange={() => toggleOne(row.id)}
                            aria-label={`Select case ${row.case_code}`}
                          />
                        </ConsoleTd>
                        <ConsoleTd>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm font-bold text-[color:var(--ink)]">
                              {row.case_code}
                            </span>
                            {(() => {
                              const tier = normalizePriorityTier(row.priority_tier);
                              return (
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                                    PRIORITY_PILL_CLASS[tier],
                                  )}
                                >
                                  {tier === "UNASSIGNED" ? t("desk.priority.UNASSIGNED") : tier}
                                </span>
                              );
                            })()}
                            {row.start_timing === "asap" && (
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                                <Flame className="mr-0.5 h-3 w-3" aria-hidden="true" />
                                ASAP
                              </span>
                            )}
                            {row.board_published_at && (
                              <span
                                className="inline-flex items-center rounded bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400"
                                title="Live on the public tutor request board"
                              >
                                On board
                              </span>
                            )}
                            {flagRow ? (
                              <RiskFlagBadge flag={flagRow.risk_flag} note={flagRow.risk_note} />
                            ) : null}
                          </div>
                          <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                            {row.title}
                          </p>
                          {flagRow?.risk_note ? (
                            <p className="mt-0.5 max-w-xs truncate text-[11px] text-muted-foreground">
                              {t("risk.note_line", {
                                defaultValue: "Risk: {{note}}",
                                note: flagRow.risk_note,
                              })}
                            </p>
                          ) : null}
                          {/* Issue #55: how this row matched the tutor-code search. */}
                          {row.matchedTutor ? (
                            <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
                              {t("caseDesk.matched_tutor_label", { defaultValue: "Matched tutor" })}
                              :{" "}
                              <span className="font-mono font-bold">
                                {row.matchedTutor.tutor_code ?? "—"}
                              </span>
                              {row.matchedTutor.display_name
                                ? ` · ${row.matchedTutor.display_name}`
                                : ""}
                            </p>
                          ) : null}
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                          </p>
                        </ConsoleTd>
                        <ConsoleTd>
                          <div className="text-sm font-bold text-[color:var(--ink)]">
                            {row.contact_name}
                          </div>
                          <a
                            href={whatsappUrl(row.contact_phone)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[color:var(--ink)]"
                          >
                            <MessageCircle className="h-3 w-3" aria-hidden="true" />
                            {row.contact_phone}
                          </a>
                        </ConsoleTd>
                        <ConsoleTd>
                          <div className="flex flex-wrap gap-1 max-w-[12rem]">
                            {(row.subjects ?? []).slice(0, 2).map((s) => (
                              <span
                                key={s}
                                className="inline-flex items-center rounded-md bg-[color:var(--ink)]/[0.06] px-2 py-0.5 text-[11px] font-medium text-[color:var(--ink)]"
                              >
                                {s}
                              </span>
                            ))}
                            {(row.subjects ?? []).length > 2 && (
                              <span className="self-center text-[11px] text-muted-foreground">
                                +{(row.subjects ?? []).length - 2} more
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {row.student_level}
                          </div>
                        </ConsoleTd>
                        <ConsoleTd className="text-xs">
                          <div className="font-medium capitalize text-[color:var(--ink)]">
                            {MODE_LABEL[row.mode] ?? row.mode}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {row.district ?? "Any area"}
                          </div>
                        </ConsoleTd>
                        <ConsoleTd className="text-xs font-semibold text-[color:var(--ink)]">
                          {budgetBounds.min === null && budgetBounds.max === null ? (
                            <span className="font-normal text-muted-foreground">Not set</span>
                          ) : (
                            <>
                              HK${budgetBounds.min ?? "?"}-{budgetBounds.max ?? "?"}
                              <span className="text-[11px] font-normal text-muted-foreground">
                                /hr
                              </span>
                            </>
                          )}
                        </ConsoleTd>
                        <ConsoleTd>
                          {/* Issue #438: MANUAL tier dropdown — the CEO lock
                              keeps priority a human decision. Setting P3/P4
                              moves the case to Hold; UNASSIGNED/P1/P2 back to
                              Active. */}
                          <Select
                            value={normalizePriorityTier(row.priority_tier)}
                            disabled={priorityMutation.isPending}
                            onValueChange={(v) => {
                              if (!v || v === normalizePriorityTier(row.priority_tier)) return;
                              priorityMutation.mutate({ id: row.id, tier: v as PriorityTier });
                            }}
                          >
                            <SelectTrigger
                              className="h-8 w-[8.5rem] border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-xs font-bold"
                              aria-label={`${t("desk.priority_label")} — ${row.case_code}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PRIORITY_TIERS.map((tier) => (
                                <SelectItem key={tier} value={tier}>
                                  {tier === "UNASSIGNED" ? t("desk.priority.UNASSIGNED") : tier}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </ConsoleTd>
                        <ConsoleTd>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold",
                              STATUS_PILL_CLASS[row.status],
                            )}
                          >
                            {STATUS_LABEL[row.status]}
                          </span>
                          {/* #451: desk language flag beside the status pill */}
                          <span
                            className="ml-1.5 inline-flex items-center rounded-full border border-[color:var(--foreground)]/15 px-2 py-0.5 text-[11px] font-bold text-muted-foreground"
                            title="Desk language"
                          >
                            {DESK_LANGUAGE_LABEL[row.desk_language] ?? row.desk_language}
                          </span>
                        </ConsoleTd>
                        <ConsoleTd>
                          <div className="flex flex-wrap gap-1 max-w-[10rem]">
                            {(row.tags ?? []).length === 0 ? (
                              <span className="text-[11px] text-muted-foreground">None</span>
                            ) : (
                              <>
                                {(row.tags ?? []).slice(0, 2).map((t) => (
                                  <span
                                    key={t}
                                    className="inline-flex items-center rounded-full border border-[color:var(--foreground)]/15 bg-[color:var(--foreground)]/[0.04] px-2 py-0.5 text-[11px] font-bold text-[color:var(--foreground)]"
                                  >
                                    {t}
                                  </span>
                                ))}
                                {(row.tags ?? []).length > 2 && (
                                  <span className="self-center text-[11px] text-muted-foreground">
                                    +{(row.tags ?? []).length - 2}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </ConsoleTd>
                        <ConsoleTd align="right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setOpenId(row.id)}
                              className="h-8 text-xs"
                            >
                              Open
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeletingId(row.id)}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </ConsoleTd>
                      </tr>
                    );
                  })}
                </ConsoleTableBody>
              </ConsoleTable>
            </div>
          )}
        </div>
      </main>

      {/* Batch Delete Confirmation Dialog */}
      <AlertDialog open={confirmBatchDelete} onOpenChange={setConfirmBatchDelete}>
        <AlertDialogContent className="border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-[color:var(--ink)]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size} Case Request{selectedIds.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected cases and their internal notes. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => batchRemoveMutation.mutate([...selectedIds])}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedIds.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Close Confirmation Dialog */}
      <AlertDialog open={confirmBatchClose} onOpenChange={setConfirmBatchClose}>
        <AlertDialogContent className="border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-[color:var(--ink)]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Close {selectedIds.size} Case Request{selectedIds.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Closed cases drop off the tutor request board and stop accepting applications. The
              records stay in this desk with a Closed status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                batchStatusMutation.mutate({ ids: [...selectedIds], status: "closed" })
              }
            >
              Close {selectedIds.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={Boolean(deletingId)} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-[color:var(--ink)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Case Request?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the case and its internal notes. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && removeMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Case
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
