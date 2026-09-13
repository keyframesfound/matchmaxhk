import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";
import {
  fetchAllTutors,
  getTutorCardHighlights,
  getTutorGenderLabel,
  type Tutor,
} from "@/features/tutors/queries";
import { TutorEditor } from "@/features/tutors/admin/TutorEditor";

export const Route = createFileRoute("/_authenticated/admin/tutors")({
  validateSearch: (search: Record<string, unknown>) => ({
    create: search.create === "1" ? true : undefined,
    applicationId:
      typeof search.applicationId === "string" && search.applicationId.trim()
        ? search.applicationId.trim()
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Tutors — MatchMax Admin" },
      { name: "description", content: "Manage tutors on MatchMax." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminTutors,
});

function AdminTutors() {
  const { hasAnyRole, loading, user } = useAuth();
  const navigate = useNavigate();
  const routeSearch = Route.useSearch();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingTutor, setEditingTutor] = useState<Tutor | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [completenessFilter, setCompletenessFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    if (!loading && !hasAnyRole(["admin", "super_admin"])) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, hasAnyRole, navigate]);

  // Arriving from an accepted join request opens the blank editor with the
  // application linked as an AI autofill source.
  useEffect(() => {
    if (routeSearch.create) {
      setIsCreating(true);
      setEditingTutor(null);
    }
  }, [routeSearch.create]);

  const clearCreateParams = () => {
    if (routeSearch.create || routeSearch.applicationId) {
      navigate({
        to: "/admin/tutors",
        search: { create: undefined, applicationId: undefined },
        replace: true,
      }).catch(() => {});
    }
  };

  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ["admin", "tutors"],
    queryFn: fetchAllTutors,
  });

  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of tutors) {
      for (const subject of row.subjects ?? []) {
        const value = (subject ?? "").trim();
        if (value) set.add(value);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tutors]);

  const districtOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of tutors) {
      const value = (row.district ?? "").trim();
      if (value) set.add(value);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tutors]);

  const hasActiveFilters =
    search.trim() !== "" ||
    visibilityFilter !== "all" ||
    formatFilter !== "all" ||
    subjectFilter !== "all" ||
    districtFilter !== "all" ||
    completenessFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setVisibilityFilter("all");
    setFormatFilter("all");
    setSubjectFilter("all");
    setDistrictFilter("all");
    setCompletenessFilter("all");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = tutors.filter((row) => {
      if (visibilityFilter === "published" && !row.is_published) return false;
      if (visibilityFilter === "hidden" && row.is_published) return false;
      if (formatFilter !== "all" && row.lesson_mode !== formatFilter) return false;
      if (
        subjectFilter !== "all" &&
        !(row.subjects ?? []).some((s) => (s ?? "").trim() === subjectFilter)
      )
        return false;
      if (districtFilter !== "all" && (row.district ?? "").trim() !== districtFilter) return false;
      if (completenessFilter !== "all") {
        const complete =
          Boolean(row.photo_url) &&
          (row.subjects ?? []).length > 0 &&
          getTutorCardHighlights(row).length > 0 &&
          row.hourly_rate > 0;
        if (completenessFilter === "complete" && !complete) return false;
        if (completenessFilter === "incomplete" && complete) return false;
      }
      if (
        q &&
        !(
          (row.display_name ?? "").toLowerCase().includes(q) ||
          (row.tutor_code ?? "").toLowerCase().includes(q) ||
          (row.subjects ?? []).some((s) => (s ?? "").toLowerCase().includes(q)) ||
          getTutorCardHighlights(row).some((highlight) => highlight.toLowerCase().includes(q))
        )
      )
        return false;
      return true;
    });

    const codeThen = (a: Tutor, b: Tutor) => a.tutor_code.localeCompare(b.tutor_code);
    const sorted = [...rows];
    if (sortBy === "rate_desc")
      sorted.sort((a, b) => b.hourly_rate - a.hourly_rate || codeThen(a, b));
    else if (sortBy === "rate_asc")
      sorted.sort((a, b) => a.hourly_rate - b.hourly_rate || codeThen(a, b));
    else if (sortBy === "name")
      sorted.sort(
        (a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? "") || codeThen(a, b),
      );
    else if (sortBy === "oldest")
      sorted.sort(
        (a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || codeThen(a, b),
      );
    else
      sorted.sort(
        (a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "") || codeThen(a, b),
      );
    return sorted;
  }, [
    tutors,
    search,
    visibilityFilter,
    formatFilter,
    subjectFilter,
    districtFilter,
    completenessFilter,
    sortBy,
  ]);

  // Keep the batch selection in sync with what is currently visible so bulk
  // publish/delete/CSV never touch rows hidden by the active filters.
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((id) => filtered.some((row) => row.id === id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown> & { id?: string }) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase
          .from("tutors")
          .update(rest as never)
          .eq("id", id as string);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tutors")
          .insert({ ...payload, created_by: user?.id ?? null } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Tutor profile saved successfully");
      queryClient.invalidateQueries({ queryKey: ["admin", "tutors"] });
      queryClient.invalidateQueries({ queryKey: ["landing", "featured_tutors"] });
      queryClient.invalidateQueries({ queryKey: ["tutors", "published"] });
      setEditingTutor(null);
      setIsCreating(false);
      clearCreateParams();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tutors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tutor deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "tutors"] });
      queryClient.invalidateQueries({ queryKey: ["landing", "featured_tutors"] });
      queryClient.invalidateQueries({ queryKey: ["tutors", "published"] });
      setDeletingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isEditorActive = isCreating || Boolean(editingTutor);

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

  const invalidateTutorQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "tutors"] });
    queryClient.invalidateQueries({ queryKey: ["landing", "featured_tutors"] });
    queryClient.invalidateQueries({ queryKey: ["tutors", "published"] });
  };

  const publishMutation = useMutation({
    mutationFn: async ({ ids, isPublished }: { ids: string[]; isPublished: boolean }) => {
      const { error } = await supabase
        .from("tutors")
        .update({ is_published: isPublished } as never)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast.success(
        `${variables.isPublished ? "Published" : "Hidden"} ${variables.ids.length} tutor${
          variables.ids.length === 1 ? "" : "s"
        }`,
      );
      invalidateTutorQueries();
      setSelectedIds(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      const { error } = await supabase
        .from("tutors")
        .update({ is_published: isPublished } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.isPublished ? "Tutor published" : "Tutor hidden");
      invalidateTutorQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const batchRemoveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("tutors").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_data, ids) => {
      toast.success(`Deleted ${ids.length} tutor${ids.length === 1 ? "" : "s"}`);
      invalidateTutorQueries();
      setSelectedIds(new Set());
      setConfirmBatchDelete(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadCsv = () => {
    const rows =
      selectedIds.size > 0 ? filtered.filter((row) => selectedIds.has(row.id)) : filtered;
    if (rows.length === 0) return;
    const columns: { label: string; value: (row: Tutor) => string }[] = [
      { label: "Tutor code", value: (row) => row.tutor_code },
      { label: "Name", value: (row) => row.display_name },
      { label: "Gender", value: (row) => getTutorGenderLabel(row.gender) ?? "" },
      { label: "Subjects", value: (row) => (row.subjects ?? []).join("; ") },
      { label: "Format", value: (row) => row.lesson_mode },
      { label: "District", value: (row) => row.district ?? "" },
      { label: "Hourly rate (HKD)", value: (row) => String(row.hourly_rate) },
      {
        label: "Experience (years)",
        value: (row) => (row.experience_years === null ? "" : String(row.experience_years)),
      },
      { label: "Languages", value: (row) => (row.languages ?? []).join("; ") },
      { label: "Academic headline", value: (row) => row.academic_headline ?? "" },
      { label: "University", value: (row) => row.university ?? "" },
      { label: "Secondary school", value: (row) => row.secondary_school ?? "" },
      { label: "Card highlights", value: (row) => getTutorCardHighlights(row).join(" | ") },
      { label: "Published", value: (row) => (row.is_published ? "yes" : "no") },
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
    link.download = `matchmax-tutors-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <main className="flex-1 bg-[color:var(--surface)]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {isEditorActive ? (
            <TutorEditor
              initialData={editingTutor}
              onSave={(data) => saveMutation.mutate(data)}
              onCancel={() => {
                setEditingTutor(null);
                setIsCreating(false);
                clearCreateParams();
              }}
              isSaving={saveMutation.isPending}
              applicationId={routeSearch.applicationId ?? null}
            />
          ) : (
            <div className="space-y-8">
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[color:var(--ink)]/10">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold tracking-tight text-[color:var(--ink)] sm:text-4xl">
                      Tutor Directory
                    </h1>
                    <span className="rounded-full bg-[color:var(--ink)]/5 px-2.5 py-0.5 text-xs font-bold text-[color:var(--ink)]">
                      {tutors.length}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add, edit, and organize verified tutors and their public profiles.
                  </p>
                </div>
                <Button onClick={() => setIsCreating(true)} className="font-bold">
                  <Plus className="mr-2 h-4 w-4" /> Add New Tutor
                </Button>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-52 flex-1 sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by code, subject, card highlight..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-10 bg-[color:var(--surface)] border-[color:var(--ink)]/15"
                  />
                </div>
                <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                  <SelectTrigger className="h-10 w-36 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All visibility</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="hidden">Hidden</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={formatFilter} onValueChange={setFormatFilter}>
                  <SelectTrigger className="h-10 w-36 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All formats</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="in_person">In-person</SelectItem>
                    <SelectItem value="either">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={completenessFilter} onValueChange={setCompletenessFilter}>
                  <SelectTrigger className="h-10 w-40 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All profiles</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                    <SelectItem value="incomplete">Incomplete</SelectItem>
                  </SelectContent>
                </Select>
                <SearchableSelect
                  value={subjectFilter}
                  onChange={setSubjectFilter}
                  options={[
                    { value: "all", label: "All subjects" },
                    ...subjectOptions.map((subject) => ({ value: subject, label: subject })),
                  ]}
                  placeholder="All subjects"
                  searchPlaceholder="Search subject..."
                  className="h-10 w-44 rounded-md"
                />
                <SearchableSelect
                  value={districtFilter}
                  onChange={setDistrictFilter}
                  options={[
                    { value: "all", label: "All districts" },
                    ...districtOptions.map((district) => ({ value: district, label: district })),
                  ]}
                  placeholder="All districts"
                  searchPlaceholder="Search district..."
                  className="h-10 w-44 rounded-md"
                />
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-10 w-44 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                    <SelectItem value="rate_desc">Rate: High to Low</SelectItem>
                    <SelectItem value="rate_asc">Rate: Low to High</SelectItem>
                    <SelectItem value="name">Name A–Z</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={clearFilters}
                    className="h-10 text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear filters
                  </Button>
                )}
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
                      disabled={publishMutation.isPending}
                      onClick={() =>
                        publishMutation.mutate({ ids: [...selectedIds], isPublished: true })
                      }
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      Publish
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={publishMutation.isPending}
                      onClick={() =>
                        publishMutation.mutate({ ids: [...selectedIds], isPublished: false })
                      }
                    >
                      <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                      Unpublish
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

              <p className="text-sm text-muted-foreground">
                Showing <span className="font-bold text-[color:var(--ink)]">{filtered.length}</span>{" "}
                of {tutors.length} tutor{tutors.length === 1 ? "" : "s"}
              </p>

              <ConsoleTable tableClassName="text-left">
                <ConsoleTableHead>
                  <tr>
                    <ConsoleTh>
                      <Checkbox
                        className="rounded-[4px]"
                        checked={allFilteredSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Select all tutors"
                      />
                    </ConsoleTh>
                    <ConsoleTh>Tutor Profile</ConsoleTh>
                    <ConsoleTh>Subjects</ConsoleTh>
                    <ConsoleTh>Format & District</ConsoleTh>
                    <ConsoleTh>Rate</ConsoleTh>
                    <ConsoleTh>Visibility</ConsoleTh>
                    <ConsoleTh align="right">Actions</ConsoleTh>
                  </tr>
                </ConsoleTableHead>
                <ConsoleTableBody>
                  {isLoading && <ConsoleTableSkeletonRows columns={7} />}

                  {!isLoading && filtered.length === 0 && (
                    <ConsoleTableEmpty
                      colSpan={7}
                      icon={Users}
                      title="No tutors found"
                      description={
                        hasActiveFilters
                          ? "No tutors match the current filters."
                          : "Get started by adding your first verified tutor profile."
                      }
                      action={
                        hasActiveFilters ? (
                          <Button onClick={clearFilters} variant="outline" size="sm">
                            <X className="mr-1.5 h-3.5 w-3.5" />
                            Clear filters
                          </Button>
                        ) : !search ? (
                          <Button onClick={() => setIsCreating(true)} variant="outline" size="sm">
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add New Tutor
                          </Button>
                        ) : undefined
                      }
                    />
                  )}

                  {filtered.map((row) => (
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
                          aria-label={`Select ${row.tutor_code || "tutor"}`}
                        />
                      </ConsoleTd>
                      <ConsoleTd>
                        <div className="flex items-center gap-3">
                          {row.photo_url ? (
                            <img
                              src={row.photo_url}
                              alt=""
                              className="h-10 w-10 rounded-xl object-cover ring-1 ring-[color:var(--ink)]/10"
                            />
                          ) : (
                            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--ink)]/[0.06] text-xs font-bold text-[color:var(--ink)]/60">
                              {(row.tutor_code || "MM").slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[color:var(--ink)] font-mono">
                                {row.tutor_code || "Unnamed"}
                              </span>
                              {getTutorGenderLabel(row.gender) && (
                                <span className="text-xs text-muted-foreground font-normal">
                                  · {getTutorGenderLabel(row.gender)}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 max-w-sm space-y-0.5 text-xs text-muted-foreground">
                              {getTutorCardHighlights(row).length > 0 ? (
                                getTutorCardHighlights(row).map((highlight, index) => (
                                  <p key={`${highlight}-${index}`} className="line-clamp-1">
                                    {highlight}
                                  </p>
                                ))
                              ) : (
                                <p>No card highlights added</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </ConsoleTd>

                      <ConsoleTd>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(row.subjects ?? []).slice(0, 3).map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center rounded-md bg-[color:var(--ink)]/[0.06] px-2 py-0.5 text-[11px] font-medium text-[color:var(--ink)]"
                            >
                              {s}
                            </span>
                          ))}
                          {(row.subjects ?? []).length > 3 && (
                            <span className="text-[11px] text-muted-foreground self-center">
                              +{(row.subjects ?? []).length - 3} more
                            </span>
                          )}
                        </div>
                      </ConsoleTd>

                      <ConsoleTd className="text-xs">
                        <div className="font-medium text-[color:var(--ink)] capitalize">
                          {row.lesson_mode === "either"
                            ? "Hybrid"
                            : row.lesson_mode.replace("_", " ")}
                        </div>
                        <div className="text-muted-foreground text-[11px]">
                          {row.district ? row.district : "All areas"}
                        </div>
                      </ConsoleTd>

                      <ConsoleTd className="font-semibold text-[color:var(--ink)]">
                        HK${row.hourly_rate}
                        <span className="text-xs text-muted-foreground font-normal">/hr</span>
                      </ConsoleTd>

                      <ConsoleTd>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={row.is_published}
                            disabled={togglePublishMutation.isPending}
                            onCheckedChange={(checked) =>
                              togglePublishMutation.mutate({ id: row.id, isPublished: checked })
                            }
                            aria-label={`${row.is_published ? "Unpublish" : "Publish"} ${
                              row.tutor_code || "tutor"
                            }`}
                          />
                          <span
                            className={cn(
                              "text-xs font-semibold",
                              row.is_published
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-muted-foreground",
                            )}
                          >
                            {row.is_published ? "Published" : "Hidden"}
                          </span>
                        </div>
                      </ConsoleTd>

                      <ConsoleTd align="right">
                        <div className="flex items-center justify-end gap-1.5">
                          {row.tutor_code ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              asChild
                              className="h-8 text-xs text-muted-foreground hover:text-[color:var(--ink)]"
                            >
                              <Link
                                to="/tutors/$tutorCode"
                                params={{ tutorCode: row.tutor_code }}
                                target="_blank"
                              >
                                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                View
                              </Link>
                            </Button>
                          ) : null}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingTutor(row)}
                            className="h-8 text-xs"
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            Edit
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
                  ))}
                </ConsoleTableBody>
              </ConsoleTable>
            </div>
          )}
        </div>
      </main>

      {/* Batch Delete Confirmation Dialog */}
      <AlertDialog open={confirmBatchDelete} onOpenChange={setConfirmBatchDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size} Tutor Profile{selectedIds.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the selected tutors? This action cannot be undone and
              will remove them from search, bookings, and public pages.
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
            <AlertDialogTitle>Delete Tutor Profile?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tutor? This action cannot be undone and will
              remove this tutor from search, bookings, and public pages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && removeMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
