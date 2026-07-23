import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listCasesForAdmin, updateCaseStatus } from "@/lib/cases.functions";

export const Route = createFileRoute("/_authenticated/admin/cases")({
  head: () => ({ meta: [{ title: "Admin — Cases" }, { name: "robots", content: "noindex" }] }),
  component: AdminCases,
});

type Row = { id: string; title: string; subject: string; student_level: string; district: string | null; status: string; is_public: boolean; created_at: string; contact_name: string; contact_phone: string; budget_min: number | null; budget_max: number | null };

const STATUSES = ["pending", "approved", "matched", "closed", "rejected"] as const;
type Status = typeof STATUSES[number];

function AdminCases() {
  const listFn = useServerFn(listCasesForAdmin);
  const updateFn = useServerFn(updateCaseStatus);
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-cases", status],
    queryFn: () => listFn({ data: { status: status === "all" ? null : status } }) as Promise<Row[]>,
  });

  const mutation = useMutation({
    mutationFn: (v: { caseId: string; status: Status }) => updateFn({ data: v }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-cases"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h1 className="text-3xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">Cases queue</h1>
          <p className="mt-2 text-sm text-muted-foreground">Approve to publish to the tutor board. Reject or close to hide.</p>

          <div className="mt-6 w-56">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="mt-10 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="mt-6 space-y-3">
              {rows.map((r) => (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link to="/cases/$caseId" params={{ caseId: r.id }} className="font-bold text-foreground hover:underline">{r.title}</Link>
                      <p className="mt-1 text-xs text-muted-foreground">{r.subject} · {r.student_level} · {r.district ?? "Any"} · HK${r.budget_min ?? 0}–{r.budget_max ?? "?"}/hr</p>
                      <p className="mt-1 text-xs text-muted-foreground">{r.contact_name} · {r.contact_phone} · {new Date(r.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold capitalize">{r.status}</span>
                      <Select value={r.status} onValueChange={(v) => mutation.mutate({ caseId: r.id, status: v as Status })}>
                        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button asChild size="sm" variant="outline"><Link to="/cases/$caseId" params={{ caseId: r.id }}>Open</Link></Button>
                    </div>
                  </div>
                </div>
              ))}
              {rows.length === 0 && <p className="text-sm text-muted-foreground">No cases.</p>}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
