import { useState } from "react";
import { MoreHorizontal, Shield, Trash2, Copy, Check, User, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_DISPLAY_NAMES, ROLE_BADGE_STYLES } from "@/features/auth/roleLabel";
import type { UserRow } from "./UserStatsOverview";

interface UsersTableProps {
  users: UserRow[];
  isLoading: boolean;
  onManageRoles: (user: UserRow) => void;
  onDeleteUser: (user: UserRow) => void;
}

const AVATAR_COLORS = [
  "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
];

function getAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function UsersTable({ users, isLoading, onManageRoles, onDeleteUser }: UsersTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success("User ID copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border/70 bg-muted/40 font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3.5">User</th>
              <th className="px-4 py-3.5">User ID</th>
              <th className="px-4 py-3.5">Granted Roles</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading &&
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={index} className="align-middle">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-44" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Skeleton className="h-4 w-24 rounded" />
                  </td>
                  <td className="px-4 py-4">
                    <Skeleton className="h-5 w-36 rounded-full" />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Skeleton className="ml-auto h-8 w-8 rounded-md" />
                  </td>
                </tr>
              ))}

            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <div className="mx-auto flex max-w-xs flex-col items-center justify-center space-y-2 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <User className="h-6 w-6" />
                    </div>
                    <p className="font-bold text-sm text-[color:var(--ink)]">No Users Found</p>
                    <p className="text-xs text-muted-foreground">
                      No accounts matched your current search query or filter selection.
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              users.map((user) => {
                const initial = (user.display_name ?? user.email ?? "U")[0].toUpperCase();
                const avatarColor = getAvatarColor(user.user_id);

                return (
                  <tr
                    key={user.user_id}
                    className="group align-middle transition-colors hover:bg-muted/30"
                  >
                    {/* User Identity Column */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-bold text-xs shadow-2xs ${avatarColor}`}
                        >
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-sm text-[color:var(--ink)]">
                            {user.display_name ?? "—"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground font-mono">
                            {user.email ?? "No email linked"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* User ID Column */}
                    <td className="px-4 py-3.5">
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
                    </td>

                    {/* Granted Roles Column */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {user.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">— None —</span>
                        ) : (
                          user.roles.map((role) => (
                            <Badge
                              key={role}
                              variant="outline"
                              className={`text-[11px] font-bold ${ROLE_BADGE_STYLES[role]}`}
                            >
                              {ROLE_DISPLAY_NAMES[role]}
                            </Badge>
                          ))
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onManageRoles(user)}
                          className="h-6 px-1.5 text-[10px] font-semibold text-muted-foreground hover:text-[color:var(--ink)]"
                        >
                          Edit
                        </Button>
                      </div>
                    </td>

                    {/* Action Dropdown Column */}
                    <td className="px-4 py-3.5 text-right">
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
                          <DropdownMenuLabel className="text-xs font-bold">
                            User Actions
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onManageRoles(user)}
                            className="cursor-pointer text-xs"
                          >
                            <Shield className="mr-2 h-3.5 w-3.5 text-indigo-500" />
                            Manage Roles
                          </DropdownMenuItem>
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
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
