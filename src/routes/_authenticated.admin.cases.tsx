import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Clock, Download, Flame, Inbox, MessageCircle, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
import {
  CASE_STATUSES,
  MODE_LABEL,
  START_LABEL,
  STATUS_LABEL,
  STATUS_PILL_CLASS,
  whatsappUrl,
  type CaseRow,
  type CaseStatus,
} from "@/features/cases/admin/shared";

export const Route = createFileRoute("/_authenticated/admin/cases")({
  head: () => ({
    meta: [
      { title: "Case Requests — MatchMax Admin" },
      { name: "description", content: "Handle incoming case requests on MatchMax." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminCases,
});

function AdminCases() {
  const { hasAnyRole, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);

  useEffect(() => {
    if (!loading && !hasAnyRole(["admin", "super_admin", "staff"])) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, hasAnyRole, navigate]);

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["admin", "cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutoring_cases")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as unknown as CaseRow[];
    },
  });

  const invalidateCases = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "cases"] });
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    cases.forEach((row) => (row.tags ?? []).forEach((t) => t && set.add(t)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [cases]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (tagFilter !== "all" && !(row.tags ?? []).includes(tagFilter)) return false;
      if (!q) return true;
      return (
        (row.case_code ?? "").toLowerCase().includes(q) ||
        (row.title ?? "").toLowerCase().includes(q) ||
        (row.contact_name ?? "").toLowerCase().includes(q) ||
        (row.contact_phone ?? "").toLowerCase().includes(q) ||
        (row.subjects ?? []).some((s) => (s ?? "").toLowerCase().includes(q)) ||
        (row.tags ?? []).some((t) => (t ?? "").toLowerCase().includes(q))
      );
    });
  }, [cases, search, statusFilter, tagFilter]);

  const openCase = openId ? (cases.find((row) => row.id === openId) ?? null) : null;

  const batchStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: CaseStatus }) => {
      const patch: Record<string, unknown> = { status };
      if (status === "contacted") patch.last_contacted_at = new Date().toISOString();
      const { error } = await supabase
        .from("tutoring_cases")
        .update(patch as never)
        .in("id", ids);
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
    filtered.length > 0 && filtered.every((row) => selectedIds.has(row.id));

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((row) => next.delete(row.id));
      } else {
        filtered.forEach((row) => next.add(row.id));
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
      selectedIds.size > 0 ? filtered.filter((row) => selectedIds.has(row.id)) : filtered;
    if (rows.length === 0) return;
    const columns: { label: string; value: (row: (typeof cases)[number]) => string }[] = [
      { label: "Case code", value: (row) => row.case_code },
      { label: "Title", value: (row) => row.title },
      { label: "Status", value: (row) => STATUS_LABEL[row.status] },
      { label: "Contact name", value: (row) => row.contact_name },
      { label: "Contact phone", value: (row) => row.contact_phone },
      { label: "Subjects", value: (row) => (row.subjects ?? []).join("; ") },
      { label: "Student level", value: (row) => row.student_level },
      { label: "District", value: (row) => row.district ?? "" },
      { label: "Lesson mode", value: (row) => MODE_LABEL[row.mode] ?? row.mode },
      { label: "Budget min (HKD)", value: (row) => String(row.budget_min ?? "") },
      { label: "Budget max (HKD)", value: (row) => String(row.budget_max ?? "") },
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
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {openCase ? (
            <CaseDetailView caseRow={openCase} allTags={allTags} onBack={() => setOpenId(null)} />
          ) : (
            <div className="space-y-8">
              {/* Header Bar */}
              <div className="flex flex-col gap-4 border-b border-[color:var(--ink)]/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight text-[color:var(--ink)] sm:text-4xl">
                      Case Requests
                    </h1>
                    <span className="rounded-full bg-[color:var(--ink)]/5 px-2.5 py-0.5 text-xs font-bold text-[color:var(--ink)]">
                      {cases.length}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Requests submitted on the site. Open a case to add notes, tags, and matched
                    tutors.
                  </p>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by code, contact, subject, tag..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-10 border-[color:var(--ink)]/15 bg-[color:var(--surface)] pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
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
                  {allTags.length > 0 ? (
                    <Select value={tagFilter} onValueChange={setTagFilter}>
                      <SelectTrigger className="h-10 w-36 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All tags</SelectItem>
                        {allTags.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
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
                      onClick={() =>
                        batchStatusMutation.mutate({ ids: [...selectedIds], status: "closed" })
                      }
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

              {/* Table Container */}
              <div className="overflow-hidden rounded-2xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] shadow-[0_1px_3px_rgba(4,19,68,0.04)]">
                <table className="w-full text-sm">
                  <thead className="border-b border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)]/60 text-left text-xs font-medium text-[color:var(--ink)]/60">
                    <tr>
                      <th className="px-5 py-3.5">
                        <Checkbox
                          className="rounded-[4px] shadow-none"
                          checked={allFilteredSelected}
                          onCheckedChange={toggleAll}
                          aria-label="Select all cases"
                        />
                      </th>
                      <th className="px-5 py-3.5">Case</th>
                      <th className="px-5 py-3.5">Parent Contact</th>
                      <th className="px-5 py-3.5">Subjects & Level</th>
                      <th className="px-5 py-3.5">Format & District</th>
                      <th className="px-5 py-3.5">Budget</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Tags</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--ink)]/[0.07]">
                    {isLoading &&
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index}>
                          <td className="px-5 py-4">
                            <Skeleton className="h-4 w-4" />
                          </td>
                          <td className="px-5 py-4">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="mt-2 h-3 w-44" />
                          </td>
                          <td className="px-5 py-4">
                            <Skeleton className="h-4 w-28" />
                          </td>
                          <td className="px-5 py-4">
                            <Skeleton className="h-5 w-24 rounded-full" />
                          </td>
                          <td className="px-5 py-4">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="px-5 py-4">
                            <Skeleton className="h-4 w-16" />
                          </td>
                          <td className="px-5 py-4">
                            <Skeleton className="h-5 w-20 rounded-full" />
                          </td>
                          <td className="px-5 py-4">
                            <Skeleton className="h-5 w-16 rounded-full" />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Skeleton className="ml-auto h-8 w-24 rounded-md" />
                          </td>
                        </tr>
                      ))}

                    {!isLoading && filtered.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-5 py-12 text-center text-muted-foreground">
                          <Inbox className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                          <p className="text-sm font-semibold text-[color:var(--ink)]">
                            No case requests found
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {search || statusFilter !== "all" || tagFilter !== "all"
                              ? "Try adjusting your filters"
                              : "New submissions from the case request form will appear here."}
                          </p>
                        </td>
                      </tr>
                    )}

                    {filtered.map((row) => (
                      <tr
                        key={row.id}
                        className={cn(
                          "transition-colors hover:bg-[color:var(--surface-subtle)]/40",
                          selectedIds.has(row.id) && "bg-[color:var(--foreground)]/[0.04]",
                        )}
                      >
                        <td className="px-5 py-4">
                          <Checkbox
                            className="rounded-[4px] shadow-none"
                            checked={selectedIds.has(row.id)}
                            onCheckedChange={() => toggleOne(row.id)}
                            aria-label={`Select case ${row.case_code}`}
                          />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm font-bold text-[color:var(--ink)]">
                              {row.case_code}
                            </span>
                            {row.start_timing === "asap" && (
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                <Flame className="mr-0.5 h-3 w-3" aria-hidden="true" />
                                ASAP
                              </span>
                            )}
                            {row.board_published_at && (
                              <span
                                className="inline-flex items-center rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400"
                                title="Live on the public tutor request board"
                              >
                                On board
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                            {row.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                            {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                          </p>
                        </td>
                        <td className="px-5 py-4">
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
                        </td>
                        <td className="px-5 py-4">
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
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <div className="font-medium capitalize text-[color:var(--ink)]">
                            {MODE_LABEL[row.mode] ?? row.mode}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {row.district ?? "Any area"}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs font-semibold text-[color:var(--ink)]">
                          {row.budget_min === null && row.budget_max === null ? (
                            <span className="font-normal text-muted-foreground">Not set</span>
                          ) : (
                            <>
                              HK${row.budget_min ?? "?"}-{row.budget_max ?? "?"}
                              <span className="text-[11px] font-normal text-muted-foreground">
                                /hr
                              </span>
                            </>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold",
                              STATUS_PILL_CLASS[row.status],
                            )}
                          >
                            {STATUS_LABEL[row.status]}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1 max-w-[10rem]">
                            {(row.tags ?? []).length === 0 ? (
                              <span className="text-[11px] text-muted-foreground/70">None</span>
                            ) : (
                              <>
                                {(row.tags ?? []).slice(0, 2).map((t) => (
                                  <span
                                    key={t}
                                    className="inline-flex items-center rounded-full border border-[color:var(--foreground)]/15 bg-[color:var(--foreground)]/[0.04] px-2 py-0.5 text-[10px] font-bold text-[color:var(--foreground)]"
                                  >
                                    {t}
                                  </span>
                                ))}
                                {(row.tags ?? []).length > 2 && (
                                  <span className="self-center text-[10px] text-muted-foreground">
                                    +{(row.tags ?? []).length - 2}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Batch Delete Confirmation Dialog */}
      <AlertDialog open={confirmBatchDelete} onOpenChange={setConfirmBatchDelete}>
        <AlertDialogContent>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={Boolean(deletingId)} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
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
