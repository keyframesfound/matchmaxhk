import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";

export const Route = createFileRoute("/_authenticated/admin/organizations")({
  head: () => ({
    meta: [{ title: "Organizations — MatchMax Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminOrganizations,
});

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  plan: "business" | "enterprise";
  status: "pending" | "active" | "suspended";
  district: string | null;
  created_at: string;
  courses: Array<{ count: number }> | null;
  organization_members: Array<{ count: number }> | null;
};

async function fetchOrganizations(): Promise<OrgRow[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "id, name, slug, plan, status, district, created_at, courses(count), organization_members(count)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as OrgRow[];
}

function AdminOrganizations() {
  const { hasAnyRole, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && !hasAnyRole(["admin", "super_admin"])) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, hasAnyRole, navigate]);

  const {
    data: orgs = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["admin-organizations"],
    queryFn: fetchOrganizations,
    enabled: hasAnyRole(["admin", "super_admin"]),
  });

  const updateOrg = useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { plan?: "business" | "enterprise"; status?: "pending" | "active" | "suspended" };
    }) => {
      const { error } = await supabase.from("organizations").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Organization updated");
      void queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const filtered = orgs.filter((org) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      org.name.toLowerCase().includes(term) ||
      org.slug.toLowerCase().includes(term) ||
      org.status.includes(term) ||
      org.plan.includes(term)
    );
  });

  const pendingCount = orgs.filter((o) => o.status === "pending").length;

  return (
    <div>
      <main className="flex-1 px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-[color:var(--ink)]">
                <Building2 className="h-6 w-6 text-[color:var(--muted-foreground)]" />
                Organizations
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {pendingCount > 0
                  ? `${orgs.length} organizations · ${pendingCount} pending activation`
                  : `${orgs.length} organizations`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 w-56 rounded-sm pl-9"
                  placeholder="Search organizations…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                aria-label="Refresh"
                onClick={() => void refetch()}
              >
                <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Organization</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Courses</th>
                  <th className="px-4 py-3 font-semibold">Members</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-4" colSpan={6}>
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      No organizations found.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  filtered.map((org) => (
                    <tr key={org.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-[color:var(--ink)]">{org.name}</p>
                        <p className="text-xs text-muted-foreground">
                          /business/{org.slug}
                          {org.district ? ` · ${org.district}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <Select
                          value={org.plan}
                          onValueChange={(value) =>
                            updateOrg.mutate({
                              id: org.id,
                              patch: { plan: value as "business" | "enterprise" },
                            })
                          }
                          disabled={updateOrg.isPending}
                        >
                          <SelectTrigger className="h-9 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="business">Business (10 courses)</SelectItem>
                            <SelectItem value="enterprise">Enterprise (unlimited)</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-4">
                        <Select
                          value={org.status}
                          onValueChange={(value) =>
                            updateOrg.mutate({
                              id: org.id,
                              patch: {
                                status: value as "pending" | "active" | "suspended",
                              },
                            })
                          }
                          disabled={updateOrg.isPending}
                        >
                          <SelectTrigger className="h-9 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-4 font-semibold text-[color:var(--ink)]">
                        {org.courses?.[0]?.count ?? 0}
                        {org.plan === "business" ? (
                          <span className="text-xs font-normal text-muted-foreground"> / 10</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 font-semibold text-[color:var(--ink)]">
                        {org.organization_members?.[0]?.count ?? 0}
                        <span className="text-xs font-normal text-muted-foreground">
                          {" "}
                          / {org.plan === "business" ? 2 : 21}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        {new Date(org.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
