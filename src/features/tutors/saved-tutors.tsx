import { type MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
    const { error } = await supabase
      .from("saved_tutors")
      .insert({ user_id: userId, tutor_id: tutorId });
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

export function TutorSaveButton({ tutorId }: { tutorId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const savedQuery = useSavedTutorIds();
  const saved = savedQuery.data?.includes(tutorId) ?? false;

  const mutation = useMutation({
    mutationFn: (nextSaved: boolean) =>
      setSavedTutor({ userId: user!.id, tutorId, saved: nextSaved }),
    onSuccess: (_data, nextSaved) => {
      queryClient.setQueryData<string[]>(savedTutorsQueryKey(user?.id), (ids = []) =>
        nextSaved ? Array.from(new Set([...ids, tutorId])) : ids.filter((id) => id !== tutorId),
      );
      void queryClient.invalidateQueries({ queryKey: ["saved-tutors"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!user) {
      toast("Sign up to save posts", {
        action: { label: "Sign up", onClick: () => void navigate({ to: "/auth" }) },
      });
      return;
    }
    mutation.mutate(!saved);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={saved ? "Remove tutor from saved posts" : "Save tutor"}
      title={saved ? "Remove from saved posts" : "Save tutor"}
      disabled={mutation.isPending || savedQuery.isLoading}
      onClick={handleClick}
      onKeyDown={(event) => event.stopPropagation()}
      className="h-9 w-9 shrink-0 rounded-sm border-[color:var(--brand-teal)]/35 text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-teal)]/10 hover:text-[color:var(--brand-navy)]"
    >
      <Bookmark className={saved ? "h-4 w-4 fill-current" : "h-4 w-4"} aria-hidden="true" />
    </Button>
  );
}
