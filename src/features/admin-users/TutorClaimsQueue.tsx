import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/**
 * Epic #280 P2: tutor card claims that need staff review — card already linked
 * to another account, or the Google email doesn't match the application email.
 * Approve links the card to the requester (resolve_tutor_claim RPC).
 */

type ClaimRow = {
  id: string;
  tutor_id: string;
  user_id: string;
  email: string | null;
  status: string;
  note: string | null;
  created_at: string;
  tutor: { tutor_code: string; display_name: string } | null;
};

export function TutorClaimsQueue() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const claimsQuery = useQuery({
    queryKey: ["admin", "tutor-claim-requests", "open"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_claim_requests")
        .select(
          "id, tutor_id, user_id, email, status, note, created_at, tutor:tutors(tutor_code, display_name)",
        )
        .eq("status", "open")
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return (data as ClaimRow[]) ?? [];
    },
  });

  const resolve = useMutation({
    mutationFn: async (input: { requestId: string; approve: boolean }) => {
      const { data, error } = await supabase.rpc("resolve_tutor_claim", {
        p_request_id: input.requestId,
        p_approve: input.approve,
        p_note: null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (result) => {
      toast.success(result === "approved" ? "Claim approved — card linked." : "Claim rejected.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "tutor-claim-requests"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not resolve the claim."),
    onSettled: () => setBusyId(null),
  });

  const claims = claimsQuery.data ?? [];
  if (claimsQuery.isLoading || claims.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[color:var(--ink)]">
          Tutor card claims awaiting review ({claims.length})
        </h3>
        <RefreshButton onRefresh={() => void claimsQuery.refetch()} />
      </div>
      <ul className="mt-3 space-y-2">
        {claims.map((claim) => (
          <li
            key={claim.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border/70 bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[color:var(--ink)]">
                {claim.tutor?.tutor_code ?? claim.tutor_id} — {claim.tutor?.display_name ?? "—"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {claim.email ?? "no email"} · {claim.note ?? "unmatched claim"} ·{" "}
                {new Date(claim.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 font-bold"
                disabled={resolve.isPending && busyId === claim.id}
                onClick={() => {
                  setBusyId(claim.id);
                  resolve.mutate({ requestId: claim.id, approve: false });
                }}
              >
                <X className="mr-1 h-3.5 w-3.5" aria-hidden />
                Reject
              </Button>
              <Button
                size="sm"
                className="h-8 font-bold"
                disabled={resolve.isPending && busyId === claim.id}
                onClick={() => {
                  setBusyId(claim.id);
                  resolve.mutate({ requestId: claim.id, approve: true });
                }}
              >
                <Check className="mr-1 h-3.5 w-3.5" aria-hidden />
                Approve & link
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RefreshButton({ onRefresh }: { onRefresh: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="h-8 text-xs font-bold" onClick={onRefresh}>
      Refresh
    </Button>
  );
}
