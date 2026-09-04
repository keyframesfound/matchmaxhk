import { type MouseEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/features/auth/useAuth";
import { fetchPublishedCourses, type CourseWithOrganization } from "@/features/courses/queries";
import { supabase } from "@/integrations/supabase/client";

export const savedCoursesQueryKey = (userId: string | undefined) =>
  ["saved-courses", userId] as const;

async function fetchSavedCourseIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("saved_courses")
    .select("course_id")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []).map((row) => row.course_id);
}

async function fetchSavedCourseCount(courseId: string): Promise<number> {
  const { count, error } = await supabase
    .from("saved_courses")
    .select("course_id", { count: "exact", head: true })
    .eq("course_id", courseId);

  if (error) throw error;
  return count ?? 0;
}

function formatSavedCourseCount(count: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(count);
}

export async function fetchSavedCourses(userId: string): Promise<CourseWithOrganization[]> {
  const [savedIds, courses] = await Promise.all([
    fetchSavedCourseIds(userId),
    fetchPublishedCourses({}, 200),
  ]);
  const savedIdSet = new Set(savedIds);
  return courses.filter((course) => savedIdSet.has(course.id));
}

export function useSavedCourseIds() {
  const { user } = useAuth();

  return useQuery({
    queryKey: savedCoursesQueryKey(user?.id),
    queryFn: () => fetchSavedCourseIds(user!.id),
    enabled: Boolean(user),
    staleTime: 60_000,
  });
}

async function setSavedCourse({
  userId,
  courseId,
  saved,
}: {
  userId: string;
  courseId: string;
  saved: boolean;
}) {
  if (saved) {
    const { error } = await supabase
      .from("saved_courses")
      .insert({ user_id: userId, course_id: courseId });
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("saved_courses")
    .delete()
    .eq("user_id", userId)
    .eq("course_id", courseId);
  if (error) throw error;
}

export function CourseSaveButton({
  courseId,
  compact = false,
}: {
  courseId: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const savedQuery = useSavedCourseIds();
  const saveCountQuery = useQuery({
    queryKey: ["saved-course-count", courseId],
    queryFn: () => fetchSavedCourseCount(courseId),
    staleTime: 60_000,
    enabled: compact,
  });
  const saved = savedQuery.data?.includes(courseId) ?? false;
  const saveCount = saveCountQuery.data ?? 0;

  const mutation = useMutation({
    mutationFn: (nextSaved: boolean) =>
      setSavedCourse({ userId: user!.id, courseId, saved: nextSaved }),
    onSuccess: (_data, nextSaved) => {
      queryClient.setQueryData<string[]>(savedCoursesQueryKey(user?.id), (ids = []) =>
        nextSaved ? Array.from(new Set([...ids, courseId])) : ids.filter((id) => id !== courseId),
      );
      queryClient.setQueryData<number>(["saved-course-count", courseId], (count = 0) =>
        Math.max(0, count + (nextSaved ? 1 : -1)),
      );
      void queryClient.invalidateQueries({ queryKey: ["saved-courses"] });
      void queryClient.invalidateQueries({ queryKey: ["saved-course-count", courseId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      setDialogOpen(true);
      return;
    }
    mutation.mutate(!saved);
  };

  return (
    <>
      <div className={compact ? "flex items-center -space-x-2" : undefined}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={saved ? "Remove course from saved posts" : "Save course"}
          title={saved ? "Remove from saved posts" : "Save course"}
          disabled={mutation.isPending}
          onClick={handleClick}
          onKeyDown={(event) => event.stopPropagation()}
          className={
            compact
              ? "h-10 w-8 shrink-0 rounded-sm border-0 bg-transparent p-0 text-[color:var(--ink)] shadow-none hover:bg-[color:var(--brand-teal)]/10 hover:text-[color:var(--ink)]"
              : "h-9 w-9 shrink-0 rounded-sm border-0 bg-transparent text-[color:var(--ink)] shadow-none hover:bg-[color:var(--brand-teal)]/10 hover:text-[color:var(--ink)]"
          }
        >
          <Bookmark
            className={
              saved
                ? compact
                  ? "h-8 w-8 fill-current"
                  : "h-5 w-5 fill-current"
                : compact
                  ? "h-8 w-8"
                  : "h-5 w-5"
            }
            aria-hidden="true"
          />
        </Button>
        {compact ? (
          <span className="min-w-4 shrink-0 whitespace-nowrap text-right text-sm font-bold leading-none text-[color:var(--ink)]">
            {formatSavedCourseCount(saveCount)}
          </span>
        ) : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-[color:var(--brand-teal)]/20 bg-[color:var(--surface)] p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[color:var(--ink)]">
              Sign up to save posts
            </DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed">
              Create a free account to bookmark courses and find them again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="rounded-sm">
                Maybe later
              </Button>
            </DialogClose>
            <Button
              type="button"
              className="rounded-sm bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setDialogOpen(false);
                window.location.assign("/auth?mode=sign_up");
              }}
            >
              Sign up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
