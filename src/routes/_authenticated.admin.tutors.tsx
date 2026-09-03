import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingTutor, setEditingTutor] = useState<Tutor | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !hasAnyRole(["admin", "super_admin"])) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, hasAnyRole, navigate]);

  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ["admin", "tutors"],
    queryFn: fetchAllTutors,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tutors;
    return tutors.filter(
      (r) =>
        (r.display_name ?? "").toLowerCase().includes(q) ||
        (r.tutor_code ?? "").toLowerCase().includes(q) ||
        (r.subjects ?? []).some((s) => (s ?? "").toLowerCase().includes(q)) ||
        getTutorCardHighlights(r).some((highlight) => highlight.toLowerCase().includes(q)),
    );
  }, [tutors, search]);

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

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--surface)]">
      <SiteHeader />
      <main className="flex-1 bg-[color:var(--surface)]">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {isEditorActive ? (
            <TutorEditor
              initialData={editingTutor}
              onSave={(data) => saveMutation.mutate(data)}
              onCancel={() => {
                setEditingTutor(null);
                setIsCreating(false);
              }}
              isSaving={saveMutation.isPending}
            />
          ) : (
            <div className="space-y-8">
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[color:var(--ink)]/10">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-black tracking-tight text-[color:var(--ink)] sm:text-4xl">
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
                <Button
                  onClick={() => setIsCreating(true)}
                  className="bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)] shadow-sm"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add New Tutor
                </Button>
              </div>

              {/* Filters & Search */}
              <div className="flex items-center justify-between gap-4">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by code, subject, card highlight..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-10 bg-[color:var(--surface)] border-[color:var(--ink)]/15"
                  />
                </div>
              </div>

              {/* Table Container */}
              <div className="overflow-hidden rounded-2xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] shadow-[0_1px_3px_rgba(4,19,68,0.04)]">
                <table className="w-full text-sm">
                  <thead className="bg-[color:var(--surface-subtle)]/60 text-left text-xs font-bold uppercase tracking-wider text-[color:var(--ink)]/60 border-b border-[color:var(--ink)]/10">
                    <tr>
                      <th className="px-5 py-3.5">Tutor Profile</th>
                      <th className="px-5 py-3.5">Subjects</th>
                      <th className="px-5 py-3.5">Format & District</th>
                      <th className="px-5 py-3.5">Rate</th>
                      <th className="px-5 py-3.5">Visibility</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--ink)]/[0.07]">
                    {isLoading &&
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index}>
                          <td className="px-5 py-4">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="mt-2 h-3 w-48" />
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
                            <Skeleton className="h-5 w-16 rounded-full" />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Skeleton className="ml-auto h-8 w-24 rounded-md" />
                          </td>
                        </tr>
                      ))}

                    {!isLoading && filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                          <Users className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                          <p className="font-semibold text-sm text-[color:var(--ink)]">
                            No tutors found
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {search
                              ? "Try adjusting your search criteria"
                              : "Get started by adding your first verified tutor profile."}
                          </p>
                          {!search && (
                            <Button
                              onClick={() => setIsCreating(true)}
                              variant="outline"
                              size="sm"
                              className="mt-4"
                            >
                              <Plus className="mr-1.5 h-3.5 w-3.5" />
                              Add New Tutor
                            </Button>
                          )}
                        </td>
                      </tr>
                    )}

                    {filtered.map((row) => (
                      <tr
                        key={row.id}
                        className="transition-colors hover:bg-[color:var(--surface-subtle)]/40"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {row.photo_url ? (
                              <img
                                src={row.photo_url}
                                alt=""
                                className="h-10 w-10 rounded-xl object-cover ring-1 ring-[color:var(--ink)]/10 shadow-sm"
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
                                {row.badge && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#77E8EE]/20 text-[#156B73]">
                                    {row.badge}
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
                        </td>

                        <td className="px-5 py-4">
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
                        </td>

                        <td className="px-5 py-4 text-xs">
                          <div className="font-medium text-[color:var(--ink)] capitalize">
                            {row.lesson_mode === "either"
                              ? "Hybrid"
                              : row.lesson_mode.replace("_", " ")}
                          </div>
                          <div className="text-muted-foreground text-[11px]">
                            {row.district ? row.district : "All areas"}
                          </div>
                        </td>

                        <td className="px-5 py-4 font-semibold text-[color:var(--ink)]">
                          HK${row.hourly_rate}
                          <span className="text-xs text-muted-foreground font-normal">/hr</span>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
                              row.is_published
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {row.is_published ? "Published" : "Hidden"}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
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
      <SiteFooter />

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
