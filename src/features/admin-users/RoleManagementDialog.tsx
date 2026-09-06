import { Shield, Check, Plus, Minus, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_DEFINITIONS, ROLE_DISPLAY_NAMES, ROLE_BADGE_STYLES } from "@/features/auth/roleLabel";
import type { AppRole } from "@/features/auth/useAuth";
import type { UserRow } from "./UserStatsOverview";

interface RoleManagementDialogProps {
  user: UserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGrantRole: (userId: string, role: AppRole) => Promise<void>;
  onRevokeRole: (userId: string, role: AppRole) => Promise<void>;
  isMutating: boolean;
}

export function RoleManagementDialog({
  user,
  open,
  onOpenChange,
  onGrantRole,
  onRevokeRole,
  isMutating,
}: RoleManagementDialogProps) {
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-border bg-card">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--foreground)]/[0.06] text-[color:var(--foreground)]">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-[color:var(--ink)]">
                Manage Roles & Access
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Grant or revoke capabilities for {user.display_name ?? user.email ?? "User"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* User context summary box */}
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-[color:var(--ink)]">
                {user.display_name ?? "Unnamed Account"}
              </span>
              <span className="ml-2 font-mono text-muted-foreground">({user.email ?? "—"})</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
              ID: {user.user_id.slice(0, 8)}...
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {user.roles.length === 0 ? (
              <span className="text-muted-foreground italic">No assigned roles</span>
            ) : (
              user.roles.map((r) => (
                <Badge
                  key={r}
                  variant="outline"
                  className={`text-[11px] font-bold ${ROLE_BADGE_STYLES[r]}`}
                >
                  {ROLE_DISPLAY_NAMES[r]}
                </Badge>
              ))
            )}
          </div>
        </div>

        {/* Role list with toggle actions */}
        <div className="mt-2 space-y-3 max-h-[380px] overflow-y-auto pr-1">
          {ROLE_DEFINITIONS.map((def) => {
            const hasRole = user.roles.includes(def.role);

            return (
              <div
                key={def.role}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3.5 transition-all ${
                  hasRole
                    ? "border-border/80 bg-card shadow-xs"
                    : "border-border/40 bg-muted/20 opacity-85"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs font-bold ${def.badgeStyle}`}>
                      {def.title}
                    </Badge>
                    {hasRole && (
                      <span className="flex items-center text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <Check className="mr-1 h-3.5 w-3.5" /> Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{def.description}</p>
                </div>

                <div className="shrink-0">
                  {hasRole ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isMutating}
                      onClick={() => onRevokeRole(user.user_id, def.role)}
                      className="h-8 border-destructive/30 text-xs font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Minus className="mr-1 h-3.5 w-3.5" /> Revoke
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={isMutating}
                      onClick={() => onGrantRole(user.user_id, def.role)}
                      className="h-8 text-xs font-bold"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Grant Role
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Note: Role insertions and revocations require Super Admin permissions in Supabase RLS.
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
