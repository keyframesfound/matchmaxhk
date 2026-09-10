import { type MouseEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AuthGateDialog,
  consumePendingSave,
  scrollPostIntoView,
} from "@/features/auth/AuthGateDialog";
import { useAuth } from "@/features/auth/useAuth";
import { fetchPublishedTutors, type Tutor } from "@/features/tutors/queries";
import { supabase } from "@/integrations/supabase/client";

export const savedTutorsQueryKey = (userId: string | undefined) =>
  ["saved-tutors", userId] as const;

async function fetchSavedTutorIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("saved_tutors")
    .select("tutor_id")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []).map((row) => row.tutor_id);
}

async function fetchSavedTutorCount(tutorId: string): Promise<number> {
  const { count, error } = await supabase
    .from("saved_tutors")
    .select("tutor_id", { count: "exact", head: true })
    .eq("tutor_id", tutorId);

  if (error) throw error;
  return count ?? 0;
}

function formatSavedTutorCount(count: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(count);
}

export async function fetchSavedTutors(userId: string): Promise<Tutor[]> {
  const [savedIds, tutors] = await Promise.all([
    fetchSavedTutorIds(userId),
    fetchPublishedTutors(),
  ]);
  const savedIdSet = new Set(savedIds);
  return tutors.filter((tutor) => savedIdSet.has(tutor.id));
}

export function useSavedTutorIds() {
  const { user } = useAuth();

  return useQuery({
    queryKey: savedTutorsQueryKey(user?.id),
    queryFn: () => fetchSavedTutorIds(user!.id),
    enabled: Boolean(user),
    staleTime: 60_000,
  });
}

async function setSavedTutor({
  userId,
  tutorId,
  saved,
}: {
  userId: string;
  tutorId: string;
  saved: boolean;
}) {
  if (saved) {
    // ignoreDuplicates: resuming a pending save for a post the user already
    // saved must not blow up with a unique-constraint (23505) error.
    const { error } = await supabase.from("saved_tutors").upsert(
      { user_id: userId, tutor_id: tutorId },
      {
        onConflict: "user_id,tutor_id",
        ignoreDuplicates: true,
      },
    );
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("saved_tutors")
    .delete()
    .eq("user_id", userId)
    .eq("tutor_id", tutorId);
  if (error) throw error;
}

export function TutorSaveButton({
  tutorId,
  compact = false,
}: {
  tutorId: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const savedQuery = useSavedTutorIds();
  const saveCountQuery = useQuery({
    queryKey: ["saved-tutor-count", tutorId],
    queryFn: () => fetchSavedTutorCount(tutorId),
    staleTime: 60_000,
    enabled: compact,
  });
  const saved = savedQuery.data?.includes(tutorId) ?? false;
  const saveCount = saveCountQuery.data ?? 0;

  const mutation = useMutation({
    mutationFn: (nextSaved: boolean) =>
      setSavedTutor({ userId: user!.id, tutorId, saved: nextSaved }),
    onSuccess: (_data, nextSaved) => {
      queryClient.setQueryData<string[]>(savedTutorsQueryKey(user?.id), (ids = []) =>
        nextSaved ? Array.from(new Set([...ids, tutorId])) : ids.filter((id) => id !== tutorId),
      );
      queryClient.setQueryData<number>(["saved-tutor-count", tutorId], (count = 0) =>
        Math.max(0, count + (nextSaved ? 1 : -1)),
      );
      void queryClient.invalidateQueries({ queryKey: ["saved-tutors"] });
      void queryClient.invalidateQueries({ queryKey: ["saved-tutor-count", tutorId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Resume a save that was interrupted by the sign-in flow (pending-save stash
  // or ?save= URL param left by the Google OAuth round-trip).
  useEffect(() => {
    if (!user) return;
    if (consumePendingSave("tutor", tutorId)) {
      scrollPostIntoView(buttonRef.current);
      mutation.mutate(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tutorId]);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
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
          ref={buttonRef}
          type="button"
          variant="ghost"
          size="icon"
          aria-label={saved ? "Remove tutor from saved posts" : "Save tutor"}
          title={saved ? "Remove from saved posts" : "Save tutor"}
          disabled={mutation.isPending}
          onClick={handleClick}
          onKeyDown={(event) => event.stopPropagation()}
          className={
            compact
              ? "h-10 w-8 shrink-0 rounded-sm border-0 bg-transparent p-0 text-[color:var(--ink)] shadow-none hover:bg-[color:var(--foreground)]/[0.06] hover:text-[color:var(--ink)]"
              : "h-9 w-9 shrink-0 rounded-sm border-0 bg-transparent text-[color:var(--ink)] shadow-none hover:bg-[color:var(--foreground)]/[0.06] hover:text-[color:var(--ink)]"
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
        {compact && saveCount > 0 ? (
          <span className="min-w-4 shrink-0 whitespace-nowrap text-right text-sm font-bold leading-none text-[color:var(--ink)]">
            {formatSavedTutorCount(saveCount)}
          </span>
        ) : null}
      </div>

      <AuthGateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Save this tutor"
        description="Sign up or log in to bookmark tutors and find them again later."
        pendingSave={saved ? undefined : { type: "tutor", id: tutorId }}
      />
    </>
  );
}
