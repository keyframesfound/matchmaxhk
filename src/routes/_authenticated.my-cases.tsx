import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyCases } from "@/lib/cases.functions";

export const Route = createFileRoute("/_authenticated/my-cases")({
  head: () => ({
    meta: [{ title: "My cases — MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: MyCases,
});

type Row = {
  id: string;
  title: string;
  subject: string;
  student_level: string;
  district: string | null;
  status: string;
  is_public: boolean;
  created_at: string;
  budget_min: number | null;
  budget_max: number | null;
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  matched: "bg-blue-100 text-blue-800",
  closed: "bg-muted text-muted-foreground",
  rejected: "bg-red-100 text-red-700",
};

function MyCases() {
  const listFn = useServerFn(listMyCases);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["my-cases"],
    queryFn: () => listFn() as Promise<Row[]>,
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              My cases
            </h1>
          </div>

          {isLoading ? (
            <div aria-label="Loading cases" className="mt-8 space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5"
                >
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/5" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              You haven't posted any cases yet.
            </div>
          ) : (
            <div className="mt-8 space-y-3">
              {rows.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5"
                >
                  <div>
                    <p className="font-bold text-foreground">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.subject} · {c.student_level} · {c.district ?? "Any district"} · Posted{" "}
                      {new Date(c.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${STATUS_STYLE[c.status] ?? "bg-muted"}`}
                  >
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
