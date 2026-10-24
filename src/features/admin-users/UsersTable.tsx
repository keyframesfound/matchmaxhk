import { useState } from "react";
import {
  MoreHorizontal,
  Shield,
  ShieldOff,
  Ban,
  ShieldCheck,
  Trash2,
  Copy,
  Check,
  User,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_DISPLAY_NAMES, ROLE_BADGE_STYLES } from "@/features/auth/roleLabel";
import { InitialAvatar } from "@/components/ui/initial-avatar";
import {
  accountStatusBadgeClass,
  accountStatusLabel,
  type StatusAction,
} from "./account-status.shared";
import type { UserRow } from "./UserStatsOverview";

interface UsersTableProps {
  users: UserRow[];
  isLoading: boolean;
  onManageRoles: (user: UserRow) => void;
  onDeleteUser: (user: UserRow) => void;
  /** Issue #308: row-level Suspend / Ban / Restore controls. */
  onStatusAction: (user: UserRow, action: StatusAction) => void;
  /** Only admins (and super admins) may ban or restore. */
  canBan: boolean;
}

export function UsersTable({
  users,
  isLoading,
  onManageRoles,
  onDeleteUser,
  onStatusAction,
  canBan,
}: UsersTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success("User ID copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <ConsoleTable density="compact" tableClassName="text-left text-xs">
      <ConsoleTableHead>
        <tr>
          <ConsoleTh>User</ConsoleTh>
          <ConsoleTh>User ID</ConsoleTh>
          <ConsoleTh>Status</ConsoleTh>
          <ConsoleTh>Granted Roles</ConsoleTh>
          <ConsoleTh align="right">Actions</ConsoleTh>
        </tr>
      </ConsoleTableHead>
      <ConsoleTableBody>
        {isLoading && <ConsoleTableSkeletonRows columns={5} rows={6} />}

        {!isLoading && users.length === 0 && (
          <ConsoleTableEmpty
            colSpan={5}
            icon={User}
            title="No users found"
            description="No accounts matched your current search query or filter selection."
          />
        )}

        {!isLoading &&
          users.map((user) => {
            return (
              <tr
                key={user.user_id}
                className="group align-middle transition-colors hover:bg-[color:var(--surface-subtle)]/40"
              >
                {/* User Identity Column, Issue #437: staff desk client faces
                    use the shared branded initial avatar (Azure/Sky palette,
                    deterministic per user_id). */}
                <ConsoleTd>
                  <div className="flex items-center gap-3">
                    <InitialAvatar
                      stableId={user.user_id}
                      name={user.display_name ?? user.email}
                      className="h-9 w-9 text-xs"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm text-[color:var(--ink)]">
                        {user.display_name ?? "—"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground font-mono">
                        {user.email ?? "No email linked"}
                      </p>
                    </div>
                  </div>
                </ConsoleTd>

                {/* User ID Column */}
                <ConsoleTd>
                  <button
                    onClick={() => handleCopyId(user.user_id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-[color:var(--ink)]"
                    title="Click to copy User ID"
                  >
                    <span>{user.user_id.slice(0, 8)}...</span>
                    {copiedId === user.user_id ? (
                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                    )}
                  </button>
                </ConsoleTd>

                {/* Account Status Column (issue #308) */}
                <ConsoleTd>
                  <Badge
                    variant="outline"
                    className={`text-[11px] font-medium ${accountStatusBadgeClass(user.account_status)}`}
                    title={user.account_status_reason ?? undefined}
                  >
                    {accountStatusLabel(user.account_status)}
                  </Badge>
                </ConsoleTd>

                {/* Granted Roles Column */}
                <ConsoleTd>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {user.roles.length === 0 ? (
                      <span className="text-xs text-muted-foreground italic">— None —</span>
                    ) : (
                      user.roles.map((role) => (
                        <Badge
                          key={role}
                          variant="outline"
                          className={`text-[11px] font-medium ${ROLE_BADGE_STYLES[role]}`}
                        >
                          {ROLE_DISPLAY_NAMES[role]}
                        </Badge>
                      ))
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onManageRoles(user)}
                      className="h-6 px-1.5 text-[11px] font-medium text-muted-foreground hover:text-[color:var(--ink)]"
                    >
                      Edit
                    </Button>
                  </div>
                </ConsoleTd>

                {/* Action Dropdown Column */}
                <ConsoleTd align="right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-[color:var(--ink)]"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel className="text-xs font-medium">
                        User Actions
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onManageRoles(user)}
                        className="cursor-pointer text-xs"
                      >
                        <Shield className="mr-2 h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                        Manage Roles
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onStatusAction(user, "suspend")}
                        className="cursor-pointer text-xs"
                      >
                        <ShieldOff className="mr-2 h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                        Suspend
                      </DropdownMenuItem>
                      {canBan && (
                        <DropdownMenuItem
                          onClick={() => onStatusAction(user, "ban")}
                          className="cursor-pointer text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                        >
                          <Ban className="mr-2 h-3.5 w-3.5" />
                          Ban
                        </DropdownMenuItem>
                      )}
                      {canBan && user.account_status && user.account_status !== "active" && (
                        <DropdownMenuItem
                          onClick={() => onStatusAction(user, "restore")}
                          className="cursor-pointer text-xs"
                        >
                          <ShieldCheck className="mr-2 h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                          Restore
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleCopyId(user.user_id)}
                        className="cursor-pointer text-xs"
                      >
                        <Copy className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                        Copy User ID
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDeleteUser(user)}
                        className="cursor-pointer text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete Account
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ConsoleTd>
              </tr>
            );
          })}
      </ConsoleTableBody>
    </ConsoleTable>
  );
}
