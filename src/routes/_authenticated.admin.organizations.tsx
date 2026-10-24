import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, FileCheck2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ConsoleTable,
  ConsoleTableBody,
  ConsoleTableEmpty,
  ConsoleTableHead,
  ConsoleTableSkeletonRows,
  ConsoleTd,
  ConsoleTh,
} from "@/components/ui/console-table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/useAuth";

export const Route = createFileRoute("/_authenticated/admin/organizations")({
  head: () => ({
    meta: [
      { title: "Organizations — MatchMax Admin" },
      { name: "description", content: "Review and manage tutoring organizations on MatchMax." },
      { name: "robots", content: "noindex" },
    ],
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
  // Issue #412 B: partner-org legal identity + BR review stamp.
  legal_entity_name: string | null;
  trading_name: string | null;
  br_number: string | null;
  rep_name: string | null;
  rep_role: string | null;
  org_type: "tutorial_centre" | "day_school" | "ngo" | null;
  edb_identifier: string | null;
  charity_identifier: string | null;
  br_reviewed_at: string | null;
};

const ORG_TYPE_LABEL: Record<string, string> = {
  tutorial_centre: "Tutorial centre",
  day_school: "Day school",
  ngo: "NGO / charity",
};

async function fetchOrganizations(): Promise<OrgRow[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "id, name, slug, plan, status, district, created_at, courses(count), organization_members(count), legal_entity_name, trading_name, br_number, rep_name, rep_role, org_type, edb_identifier, charity_identifier, br_reviewed_at",
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
      // Issue #412: activation is gated on the BR review — staff must have
      // stamped br_reviewed_at (or the org must already carry BR identity)
      // before the org can go live on the public directory.
      if (patch.status === "active") {
        const { data: org } = await supabase
          .from("organizations")
          .select("br_reviewed_at, br_number")
          .eq("id", id)
          .maybeSingle();
        if (org && !org.br_reviewed_at && !org.br_number) {
          throw new Error(
            "Review the Business Registration first — open Review and stamp it before activating.",
          );
        }
      }
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

  const [reviewOrg, setReviewOrg] = useState<OrgRow | null>(null);

  // Issue #412: staff stamp the BR review. Activation (status → active) is
  // refused in updateOrg until a review stamp or BR identity exists.
  const markBrReviewed = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("organizations")
        .update({ br_reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Business Registration marked as reviewed");
      void queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
      setReviewOrg(null);
    },
    onError: (error: Error) => toast.error(error.message),
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

          <ConsoleTable
            className="mt-6"
            density="compact"
            minTableWidth="760px"
            tableClassName="text-left"
          >
            <ConsoleTableHead>
              <tr>
                <ConsoleTh>Organization</ConsoleTh>
                <ConsoleTh>Plan</ConsoleTh>
                <ConsoleTh>Status</ConsoleTh>
                <ConsoleTh>BR</ConsoleTh>
                <ConsoleTh>Courses</ConsoleTh>
                <ConsoleTh>Members</ConsoleTh>
                <ConsoleTh>Created</ConsoleTh>
              </tr>
            </ConsoleTableHead>
            <ConsoleTableBody>
              {isLoading && <ConsoleTableSkeletonRows columns={7} rows={3} />}
              {!isLoading && filtered.length === 0 && (
                <ConsoleTableEmpty colSpan={7} icon={Building2} title="No organizations found" />
              )}
              {!isLoading &&
                filtered.map((org) => (
                  <tr key={org.id}>
                    <ConsoleTd>
                      <p className="font-semibold text-[color:var(--ink)]">{org.name}</p>
                      <p className="text-xs text-muted-foreground">
                        /business/{org.slug}
                        {org.district ? ` · ${org.district}` : ""}
                      </p>
                    </ConsoleTd>
                    <ConsoleTd>
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
                    </ConsoleTd>
                    <ConsoleTd>
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
                    </ConsoleTd>
                    <ConsoleTd>
                      {org.br_reviewed_at ? (
                        <Badge
                          variant="outline"
                          className="gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                        >
                          <FileCheck2 className="h-3 w-3" /> Reviewed
                        </Badge>
                      ) : org.br_number ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => setReviewOrg(org)}
                        >
                          Review BR
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </ConsoleTd>
                    <ConsoleTd className="font-semibold text-[color:var(--ink)]">
                      {org.courses?.[0]?.count ?? 0}
                      {org.plan === "business" ? (
                        <span className="text-xs font-normal text-muted-foreground"> / 10</span>
                      ) : null}
                    </ConsoleTd>
                    <ConsoleTd className="font-semibold text-[color:var(--ink)]">
                      {org.organization_members?.[0]?.count ?? 0}
                      <span className="text-xs font-normal text-muted-foreground">
                        {" "}
                        / {org.plan === "business" ? 2 : 21}
                      </span>
                    </ConsoleTd>
                    <ConsoleTd className="text-muted-foreground">
                      {new Date(org.created_at).toLocaleDateString()}
                    </ConsoleTd>
                  </tr>
                ))}
            </ConsoleTableBody>
          </ConsoleTable>

          {/* Issue #412: BR review dialog — staff verify the Business
              Registration (and EDB/charity identifier when present) against
              the official records before stamping; activation stays blocked
              until the stamp exists. */}
          <Dialog open={reviewOrg !== null} onOpenChange={(open) => !open && setReviewOrg(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" /> Business Registration review
                </DialogTitle>
                <DialogDescription>
                  Verify these details against the Companies Registry / IRD and the EDB school
                  search before stamping. Stamping unlocks activation.
                </DialogDescription>
              </DialogHeader>
              {reviewOrg ? (
                <div className="space-y-2 text-sm">
                  {[
                    ["Legal entity", reviewOrg.legal_entity_name],
                    ["Trading name", reviewOrg.trading_name],
                    ["BR number", reviewOrg.br_number],
                    [
                      "Organisation type",
                      reviewOrg.org_type ? ORG_TYPE_LABEL[reviewOrg.org_type] : null,
                    ],
                    ["EDB / charity ID", reviewOrg.edb_identifier ?? reviewOrg.charity_identifier],
                    [
                      "Representative",
                      reviewOrg.rep_name
                        ? `${reviewOrg.rep_name} (${reviewOrg.rep_role ?? ""})`
                        : null,
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label as string}
                      className="flex justify-between gap-4 border-b border-border pb-2"
                    >
                      <span className="text-muted-foreground">{label}</span>
                      <span className="text-right font-medium text-[color:var(--ink)]">
                        {value || "—"}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setReviewOrg(null)}>
                      Not yet
                    </Button>
                    <Button
                      variant="solid"
                      color="blue"
                      disabled={markBrReviewed.isPending}
                      onClick={() => markBrReviewed.mutate(reviewOrg.id)}
                    >
                      {markBrReviewed.isPending ? "Saving…" : "Mark BR reviewed"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
