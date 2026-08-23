import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/features/auth/useAuth";
import { deleteUserAccount } from "@/lib/cases.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Users & roles — MatchMax admin" },
      {
        name: "description",
        content:
          "Grant or revoke MatchMax user roles — manage admins, staff, tutors, and parent accounts across the platform.",
      },
      { property: "og:url", content: "https://matchmax.hk/admin/users" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/admin/users" }],
  }),
  component: AdminUsers,
});

const ROLES: AppRole[] = ["super_admin", "admin", "staff", "tutor", "parent"];

type Row = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  roles: AppRole[];
};

function AdminUsers() {
  const { t } = useTranslation();
  const { hasAnyRole, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const deleteFn = useServerFn(deleteUserAccount);
  const [search, setSearch] = useState("");
  const [addRole, setAddRole] = useState<Record<string, AppRole>>({});

  useEffect(() => {
    if (!loading && !hasAnyRole(["admin", "super_admin"])) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, hasAnyRole, navigate]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async (): Promise<Row[]> => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, email")
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
        roles: byUser.get(p.id) ?? [],
      }));
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.email?.toLowerCase().includes(q) || r.display_name?.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const grant = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role granted");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAccount = useMutation({
    mutationFn: async (userId: string) => {
      return deleteFn({ data: { userId } });
    },
    onSuccess: () => {
      toast.success("Account deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role revoked");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <h1 className="text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
            {t("admin.users_title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("admin.users_subtitle")}</p>

          <div className="mt-8">
            <Input
              placeholder={t("admin.search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{t("admin.name")}</th>
                  <th className="px-4 py-3">{t("admin.email")}</th>
                  <th className="px-4 py-3">{t("admin.roles")}</th>
                  <th className="px-4 py-3 text-right">{t("admin.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index} className="border-t border-border">
                      <td className="px-4 py-4">
                        <Skeleton className="h-4 w-28" />
                      </td>
                      <td className="px-4 py-4">
                        <Skeleton className="h-4 w-44" />
                      </td>
                      <td className="px-4 py-4">
                        <Skeleton className="h-5 w-24 rounded-full" />
                      </td>
                      <td className="px-4 py-4">
                        <Skeleton className="ml-auto h-9 w-36" />
                      </td>
                    </tr>
                  ))}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      {t("admin.no_users")}
                    </td>
                  </tr>
                )}
                {filtered.map((row) => (
                  <tr key={row.user_id} className="border-t border-border align-top">
                    <td className="px-4 py-4 font-semibold">{row.display_name ?? "—"}</td>
                    <td className="px-4 py-4 text-muted-foreground">{row.email ?? "—"}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {row.roles.length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {row.roles.map((r) => (
                          <span
                            key={r}
                            className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-teal)]/10 px-2.5 py-1 text-[11px] font-bold text-[color:var(--brand-teal)]"
                          >
                            {r.replace("_", " ")}
                            <button
                              className="opacity-70 hover:opacity-100"
                              onClick={() => revoke.mutate({ userId: row.user_id, role: r })}
                              aria-label={`Revoke ${r}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Select
                          value={addRole[row.user_id] ?? ""}
                          onValueChange={(v) =>
                            setAddRole((s) => ({ ...s, [row.user_id]: v as AppRole }))
                          }
                        >
                          <SelectTrigger className="h-9 w-[140px]">
                            <SelectValue placeholder={t("admin.select_role")} />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.filter((r) => !row.roles.includes(r)).map((r) => (
                              <SelectItem key={r} value={r}>
                                {r.replace("_", " ")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          className="h-9 bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]"
                          disabled={!addRole[row.user_id]}
                          onClick={() => {
                            const r = addRole[row.user_id];
                            if (!r) return;
                            grant.mutate({ userId: row.user_id, role: r });
                            setAddRole((s) => ({ ...s, [row.user_id]: "" as AppRole }));
                          }}
                        >
                          {t("admin.grant")}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-9 font-bold"
                          onClick={() => {
                            const confirmed = window.confirm(
                              "Delete this account? This will remove the user, their tutor profile, and their roles.",
                            );
                            if (!confirmed) return;
                            deleteAccount.mutate(row.user_id);
                          }}
                          disabled={deleteAccount.isPending}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
