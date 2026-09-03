import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Trash2, UserPlus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InviteMemberModal } from "@/features/business/invite-member-modal";
import { removeMember } from "@/features/business/business.functions";
import { useAuth } from "@/features/auth/useAuth";
import { useMyOrganization } from "@/features/business/useMyOrganization";
import { supabase } from "@/integrations/supabase/client";

type OrgMember = {
  id: string;
  email: string;
  role: "owner" | "admin";
  status: "pending" | "active" | "revoked";
  user_id: string | null;
};

async function fetchMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, email, role, status, user_id")
    .eq("organization_id", orgId)
    .neq("status", "revoked")
    .order("invited_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as OrgMember[];
}

export function TeamPanel() {
  const { user } = useAuth();
  const { membership, organization, usage } = useMyOrganization();
  const queryClient = useQueryClient();
  const removeFn = useServerFn(removeMember);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const orgId = organization?.id ?? null;
  const { data: members, isLoading } = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () => fetchMembers(orgId as string),
    enabled: !!orgId,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["org-members"] });
    void queryClient.invalidateQueries({ queryKey: ["my-organization"] });
  }, [queryClient]);

  const isOwner = membership?.role === "owner";
  const atLimit = usage ? usage.memberCount >= usage.memberLimit : false;

  const handleRemove = async (member: OrgMember) => {
    if (member.role === "owner") {
      toast.error("The organization owner cannot be removed.");
      return;
    }
    if (!window.confirm(`Remove ${member.email} from this organization?`)) return;
    setBusy(true);
    try {
      await (removeFn({
        data: { orgId: orgId as string, memberId: member.id },
      }) as Promise<unknown>);
      toast.success("Member removed");
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove member");
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm("Leave this organization? You'll lose admin access.")) return;
    if (!orgId) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("organization_members")
        .delete()
        .eq("organization_id", orgId)
        .eq("user_id", user?.id ?? "");
      if (error) throw new Error(error.message);
      toast.success("You've left the organization");
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to leave organization");
    } finally {
      setBusy(false);
    }
  };

  function isSelfRow(row: OrgMember): boolean {
    return !!row.user_id && row.user_id === user?.id && row.role !== "owner";
  }

  if (!organization) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {usage?.memberCount ?? members?.length ?? 1} of {usage?.memberLimit ?? 2} seats used
        </p>
        <Button
          disabled={atLimit}
          onClick={() => setInviteOpen(true)}
          className="bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Invite admin
        </Button>
      </div>

      {atLimit && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
          Team seats are full for your plan. Remove a member or upgrade to Enterprise to invite up
          to 20 admins.
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Member</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 2 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3" colSpan={4}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))}
            {!isLoading &&
              (members ?? []).map((member) => {
                const isSelf = !!member.user_id && member.user_id === user?.id;
                const canRemove =
                  member.role !== "owner" && (isOwner ? !isSelfRow(member) : isSelfRow(member));
                return (
                  <tr key={member.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1FA8B6]/10 text-xs font-bold text-[#1FA8B6]">
                          {(member.email || "?").charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[color:var(--ink)]">
                            {member.email}
                          </p>
                          {isSelf ? <p className="text-xs text-muted-foreground">You</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                          member.role === "owner"
                            ? "bg-violet-50 text-violet-700 ring-violet-700/10"
                            : "bg-blue-50 text-blue-700 ring-blue-700/10"
                        }`}
                      >
                        {member.role === "owner" ? "Owner" : "Admin"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                          member.status === "active"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-700/10"
                            : "bg-amber-50 text-amber-700 ring-amber-700/10"
                        }`}
                      >
                        {member.status === "active" ? "Active" : "Invite pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canRemove && (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={busy}
                          aria-label={
                            isOwner && !isSelfRow(member) ? "Remove member" : "Leave organization"
                          }
                          onClick={() =>
                            isOwner && !isSelfRow(member)
                              ? void handleRemove(member)
                              : void handleLeave()
                          }
                        >
                          {isOwner && !isSelfRow(member) ? (
                            <Trash2 className="h-4 w-4 text-red-500" />
                          ) : (
                            <LogOut className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Invited admins can manage courses and settings once they sign up with their invited email.
        {isOwner ? " Only you can remove members." : ""}
      </p>

      {orgId && (
        <InviteMemberModal
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          orgId={orgId}
          onInvited={invalidate}
        />
      )}
    </div>
  );
}
