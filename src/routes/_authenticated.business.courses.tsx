import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Pencil, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/business/empty-state";
import { BusinessLayout } from "@/components/business/business-layout";
import { CourseFormModal } from "@/features/business/course-form-modal";
import { useMyOrganization } from "@/features/business/useMyOrganization";
import { courseModeLabel, formatCoursePrice, type Course } from "@/features/courses/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/business/courses")({
  head: () => ({
    meta: [{ title: "Manage courses | MatchMax" }],
  }),
  component: BusinessCoursesPage,
});

async function fetchMyCourses(orgId: string): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Course[];
}

function BusinessCoursesPage() {
  const { membership, organization, usage, isLoading: orgLoading } = useMyOrganization();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [coursePendingDeletion, setCoursePendingDeletion] = useState<Course | null>(null);

  const orgId = organization?.id ?? null;
  const { data: courses, isLoading } = useQuery({
    queryKey: ["my-courses", orgId],
    queryFn: () => fetchMyCourses(orgId as string),
    enabled: !!orgId,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["my-courses"] });
    void queryClient.invalidateQueries({ queryKey: ["my-organization"] });
    void queryClient.invalidateQueries({ queryKey: ["courses"] });
  }, [queryClient]);

  const atLimit = useMemo(() => {
    if (!usage) return false;
    return usage.courseLimit !== null && usage.coursesUsed >= usage.courseLimit;
  }, [usage]);

  const handleTogglePublished = async (course: Course, next: boolean) => {
    const { error } = await supabase
      .from("courses")
      .update({ is_published: next })
      .eq("id", course.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next ? "Course published" : "Course unpublished");
    invalidate();
  };

  const handleDelete = async (course: Course) => {
    const { error } = await supabase.from("courses").delete().eq("id", course.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Course deleted");
    setCoursePendingDeletion(null);
    invalidate();
  };

  if (orgLoading || (orgId && isLoading && !courses)) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/40">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading courses…</p>
        </main>
      </div>
    );
  }

  if (!membership || !organization) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <EmptyState
            icon={BookOpen}
            title="No business account yet"
            description="Create a business account to post courses on MatchMax."
            action={
              <Button asChild>
                <a href="/business/join">Create a business account</a>
              </Button>
            }
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <BusinessLayout organization={organization} usage={usage}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[color:var(--ink)]">Courses</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {usage?.courseLimit == null
                ? "Unlimited courses on your plan"
                : `${usage.coursesUsed} of ${usage.courseLimit} course slots used`}
            </p>
          </div>
          <Button
            disabled={atLimit || organization.status === "suspended"}
            onClick={() => {
              setEditingCourse(null);
              setFormOpen(true);
            }}
            className="bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            New course
          </Button>
        </div>

        {atLimit && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
            You've used all {usage?.courseLimit} course slots on the Business plan. Delete a course
            or upgrade to Enterprise for unlimited courses.
          </div>
        )}

        <div className="mt-6 space-y-3">
          {isLoading && (
            <>
              <Skeleton className="h-20 rounded-lg border border-border" />
              <Skeleton className="h-20 rounded-lg border border-border" />
              <Skeleton className="h-20 rounded-lg border border-border" />
            </>
          )}

          {!isLoading && (courses ?? []).length === 0 && (
            <EmptyState
              icon={BookOpen}
              title="No courses yet"
              description="Post your first course and it will appear in the public courses directory once your account is activated."
              action={
                <Button
                  onClick={() => setFormOpen(true)}
                  className="bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Post your first course
                </Button>
              }
            />
          )}

          {!isLoading &&
            (courses ?? []).map((course) => {
              const price = formatCoursePrice(course.price, course.currency);
              return (
                <div
                  key={course.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {course.level ? (
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                          {course.level}
                        </span>
                      ) : null}
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                          course.is_published
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-700/10"
                            : "bg-gray-100 text-gray-600 ring-gray-500/10"
                        }`}
                      >
                        {course.is_published ? "Published" : "Unpublished"}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-sm font-bold text-[color:var(--ink)]">
                      {course.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {courseModeLabel(course.mode)}
                      {course.district ? ` · ${course.district}` : ""}
                      {price ? ` · ${price}` : ""}
                      {course.schedule_text ? ` · ${course.schedule_text}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Switch
                      checked={course.is_published}
                      onCheckedChange={(checked) => void handleTogglePublished(course, checked)}
                      aria-label="Toggle published"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Edit course"
                      onClick={() => {
                        setEditingCourse(course);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Delete course"
                      onClick={() => setCoursePendingDeletion(course)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              );
            })}
          <CourseFormModal
            open={formOpen}
            onOpenChange={(open) => {
              setFormOpen(open);
              if (!open) setEditingCourse(null);
            }}
            organization={organization}
            course={editingCourse}
            onSaved={() => {
              setFormOpen(false);
              setEditingCourse(null);
              invalidate();
            }}
          />
          <AlertDialog
            open={coursePendingDeletion !== null}
            onOpenChange={(open) => {
              if (!open) setCoursePendingDeletion(null);
            }}
          >
            <AlertDialogContent className="max-w-md rounded-lg border-border bg-card p-6">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete course?</AlertDialogTitle>
                <AlertDialogDescription>
                  {coursePendingDeletion
                    ? `"${coursePendingDeletion.title}" will be permanently removed from your business account.`
                    : "This action cannot be undone."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-2 sm:justify-end">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    if (coursePendingDeletion) void handleDelete(coursePendingDeletion);
                  }}
                >
                  Delete course
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </BusinessLayout>
    </div>
  );
}
