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
import { supabase } from "@/integrations/supabase/client";

export const savedCasesQueryKey = (userId: string | undefined) => ["saved-cases", userId] as const;

async function fetchSavedCaseIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("saved_cases")
    .select("case_id")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []).map((row) => row.case_id);
}

export function useSavedCaseIds() {
  const { user } = useAuth();

  return useQuery({
    queryKey: savedCasesQueryKey(user?.id),
    queryFn: () => fetchSavedCaseIds(user!.id),
    enabled: Boolean(user),
    staleTime: 60_000,
  });
}

async function setSavedCase({
  userId,
  caseId,
  saved,
}: {
  userId: string;
  caseId: string;
  saved: boolean;
}) {
  if (saved) {
    const { error } = await supabase
      .from("saved_cases")
      .insert({ user_id: userId, case_id: caseId });
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("saved_cases")
    .delete()
    .eq("user_id", userId)
    .eq("case_id", caseId);
  if (error) throw error;
}

export function CaseSaveButton({ caseId, compact = false }: { caseId: string; compact?: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const savedQuery = useSavedCaseIds();
  const saved = savedQuery.data?.includes(caseId) ?? false;

  const mutation = useMutation({
    mutationFn: (nextSaved: boolean) =>
      setSavedCase({ userId: user!.id, caseId, saved: nextSaved }),
    onSuccess: (_data, nextSaved) => {
      queryClient.setQueryData<string[]>(savedCasesQueryKey(user?.id), (ids = []) =>
        nextSaved ? Array.from(new Set([...ids, caseId])) : ids.filter((id) => id !== caseId),
      );
      void queryClient.invalidateQueries({ queryKey: ["saved-cases"] });
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
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={saved ? "Remove request from saved posts" : "Save request"}
        title={saved ? "Remove from saved posts" : "Save request"}
        disabled={mutation.isPending}
        onClick={handleClick}
        onKeyDown={(event) => event.stopPropagation()}
        className={
          compact
            ? "h-10 w-8 shrink-0 rounded-sm border-0 bg-transparent p-0 text-[color:var(--ink)] shadow-none hover:bg-[color:var(--foreground)]/[0.06] hover:text-[color:var(--ink)]"
            : "h-9 w-9 shrink-0 rounded-sm border-0 bg-transparent text-[color:var(--ink)] shadow-none hover:bg-[color:var(--foreground)]/[0.06] hover:text-[color:var(--ink)]"
        }
      >
        <Bookmark className={saved ? "h-5 w-5 fill-current" : "h-5 w-5"} aria-hidden="true" />
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl border-border bg-[color:var(--surface)] p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[color:var(--ink)]">
              Sign up to save posts
            </DialogTitle>
            <DialogDescription className="pt-2 leading-relaxed">
              Create a free account to bookmark tutoring requests and find them again later.
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
              className="rounded-sm font-bold"
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
