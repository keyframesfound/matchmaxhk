import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users, Search, UserPlus, RefreshCw, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/features/auth/useAuth";
import { deleteUserAccount } from "@/lib/cases.functions";
import { provisionUserAccount } from "@/lib/account.functions";
import { ROLE_DISPLAY_NAMES } from "@/features/auth/roleLabel";

import { UserStatsOverview, type UserRow } from "@/features/admin-users/UserStatsOverview";
import { UsersTable } from "@/features/admin-users/UsersTable";
import { RolesMatrixTab } from "@/features/admin-users/RolesMatrixTab";
import { RoleManagementDialog } from "@/features/admin-users/RoleManagementDialog";
import { InviteUserDialog } from "@/features/admin-users/InviteUserDialog";
import { DeleteUserAlertDialog } from "@/features/admin-users/DeleteUserAlertDialog";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "User Directory & Access Control — MatchMax Admin" },
      {
        name: "description",
        content:
          "Manage platform users, provision new accounts, and grant or revoke security roles across MatchMax.",
      },
      { property: "og:url", content: "https://matchmax.hk/admin/users" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/admin/users" }],
  }),
  component: AdminUsers,
});

function AdminUsers() {
  const { t } = useTranslation();
  const { hasAnyRole, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const deleteFn = useServerFn(deleteUserAccount);
  const provisionFn = useServerFn(provisionUserAccount);

  // Filter & Search states
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name">("newest");
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");

  // Dialog States
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [roleUser, setRoleUser] = useState<UserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);

  useEffect(() => {
    if (!loading && !hasAnyRole(["admin", "super_admin"])) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, hasAnyRole, navigate]);

  // Fetch Users & Roles
  const {
    data: rows = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async (): Promise<UserRow[]> => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, email, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (pErr) throw pErr;
      if (rErr) throw rErr;

      const byUser = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r: { user_id: string; role: AppRole }) => {
        const arr = byUser.get(r.user_id) ?? [];
        arr.push(r.role);
        byUser.set(r.user_id, arr);
      });

      return (profiles ?? []).map((p) => ({
        user_id: p.id,
        display_name: p.display_name,
        email: p.email,
        created_at: p.created_at,
        roles: byUser.get(p.id) ?? [],
      }));
    },
  });

  // Filter & Sort Logic
  const filteredUsers = useMemo(() => {
    let result = [...rows];
    const q = search.trim().toLowerCase();

    if (q) {
      result = result.filter(
        (r) =>
          r.email?.toLowerCase().includes(q) ||
          r.display_name?.toLowerCase().includes(q) ||
          r.user_id.toLowerCase().includes(q),
      );
    }

    if (roleFilter !== "all") {
      result = result.filter((r) => r.roles.includes(roleFilter as AppRole));
    }

    if (sortBy === "name") {
      result.sort((a, b) =>
        (a.display_name ?? a.email ?? "").localeCompare(b.display_name ?? b.email ?? ""),
      );
    } else if (sortBy === "oldest") {
      result.sort(
        (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
      );
    } else {
      // newest
      result.sort(
        (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
      );
    }

    return result;
  }, [rows, search, roleFilter, sortBy]);

  // Mutations
  const grantMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success("Role granted successfully");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      if (roleUser && roleUser.user_id === variables.userId) {
        setRoleUser((prev) => (prev ? { ...prev, roles: [...prev.roles, variables.role] } : null));
      }
    },
    onError: (e: Error) => toast.error(`Failed to grant role: ${e.message}`),
  });

  const revokeMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success("Role revoked successfully");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      if (roleUser && roleUser.user_id === variables.userId) {
        setRoleUser((prev) =>
          prev ? { ...prev, roles: prev.roles.filter((r) => r !== variables.role) } : null,
        );
      }
    },
    onError: (e: Error) => toast.error(`Failed to revoke role: ${e.message}`),
  });

  const provisionMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      displayName?: string;
      password?: string;
      role: AppRole;
    }) => {
      return provisionFn({ data });
    },
    onSuccess: (res) => {
      toast.success(`Account created for ${res.email}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (userId: string) => {
      return deleteFn({ data: { userId } });
    },
    onSuccess: () => {
      toast.success("Account permanently deleted");
      setDeleteUser(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasActiveFilters = search.trim() !== "" || roleFilter !== "all" || sortBy !== "newest";

  const clearFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setSortBy("newest");
  };

  return (
    <div>
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
          {/* Top Page Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border/60">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-3xl font-bold tracking-tight text-[color:var(--ink)] sm:text-4xl">
                  User Directory & Access
                </h1>
                <span className="rounded-full bg-[color:var(--ink)]/5 px-2.5 py-0.5 text-xs font-bold text-[color:var(--ink)]">
                  {rows.length} {rows.length === 1 ? "User" : "Users"}
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Manage account access, assign platform security roles, and provision new user
                profiles.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isRefetching}
                className="h-9 gap-1.5 font-bold text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => setIsInviteOpen(true)}
                className="h-9 gap-1.5 font-bold text-xs"
              >
                <UserPlus className="h-4 w-4" />
                Invite User
              </Button>
            </div>
          </div>

          {/* Cloudflare KPI Overview Cards */}
          <UserStatsOverview users={rows} isLoading={isLoading} />

          {/* Main Tabs Container */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "users" | "roles")}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-3">
              <TabsList className="bg-muted/60 p-1">
                <TabsTrigger value="users" className="gap-2 text-xs font-bold">
                  <Users className="h-3.5 w-3.5" />
                  All Users ({filteredUsers.length})
                </TabsTrigger>
                <TabsTrigger value="roles" className="gap-2 text-xs font-bold">
                  <Shield className="h-3.5 w-3.5" />
                  Roles & Matrix
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ALL USERS TAB CONTENT */}
            <TabsContent value="users" className="mt-6 space-y-4 focus-visible:outline-none">
              {/* Filter Controls Bar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/70 bg-card p-3 shadow-xs">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by display name, email, or ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[color:var(--ink)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="h-9 w-[150px] text-xs font-semibold">
                      <SelectValue placeholder="Filter by Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {(["super_admin", "admin", "staff", "tutor", "parent"] as AppRole[]).map(
                        (role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_DISPLAY_NAMES[role]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                    <SelectTrigger className="h-9 w-[140px] text-xs font-semibold">
                      <SelectValue placeholder="Sort Order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="name">Name A-Z</SelectItem>
                    </SelectContent>
                  </Select>

                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="h-9 text-xs font-semibold text-muted-foreground hover:text-[color:var(--ink)]"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Data Table */}
              <UsersTable
                users={filteredUsers}
                isLoading={isLoading}
                onManageRoles={(user) => setRoleUser(user)}
                onDeleteUser={(user) => setDeleteUser(user)}
              />
            </TabsContent>

            {/* ROLES MATRIX TAB CONTENT */}
            <TabsContent value="roles" className="mt-6 focus-visible:outline-none">
              <RolesMatrixTab users={rows} />
            </TabsContent>
          </Tabs>

          {/* Dialogs */}
          <RoleManagementDialog
            user={roleUser}
            open={!!roleUser}
            onOpenChange={(open) => !open && setRoleUser(null)}
            onGrantRole={async (userId, role) => {
              await grantMutation.mutateAsync({ userId, role });
            }}
            onRevokeRole={async (userId, role) => {
              await revokeMutation.mutateAsync({ userId, role });
            }}
            isMutating={grantMutation.isPending || revokeMutation.isPending}
          />

          <InviteUserDialog
            open={isInviteOpen}
            onOpenChange={setIsInviteOpen}
            onProvision={async (data) => {
              await provisionMutation.mutateAsync(data);
            }}
            isPending={provisionMutation.isPending}
          />

          <DeleteUserAlertDialog
            user={deleteUser}
            open={!!deleteUser}
            onOpenChange={(open) => !open && setDeleteUser(null)}
            onConfirmDelete={async (userId) => {
              await deleteAccountMutation.mutateAsync(userId);
            }}
            isDeleting={deleteAccountMutation.isPending}
          />
        </div>
      </main>
    </div>
  );
}
