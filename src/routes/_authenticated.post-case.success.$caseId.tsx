import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { getMatchesForCase } from "@/lib/cases.functions";

export const Route = createFileRoute("/_authenticated/post-case/success/$caseId")({
  head: () => ({
    meta: [
      { title: "Case submitted — MatchMax" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SuccessPage,
});

type Match = { id: string; tutor_code: string; display_name: string; photo_url: string | null; hourly_rate: number; district: string | null; score: number };

function SuccessPage() {
  const { caseId } = Route.useParams();
  const getMatches = useServerFn(getMatchesForCase);
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["case-matches", caseId],
    queryFn: () => getMatches({ data: { caseId } }) as Promise<Match[]>,
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <div className="rounded-3xl border border-[color:var(--brand-teal)]/30 bg-brand-gradient/5 p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[color:var(--brand-teal)]" />
            <h1 className="mt-4 text-3xl font-black tracking-tight text-[color:var(--brand-navy)]">Case submitted!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Our team will review your request shortly. Here are the top matches based on your criteria — you can reach out directly.
            </p>
          </div>

          <h2 className="mt-10 text-xl font-bold text-[color:var(--brand-navy)]">Top matches</h2>
          {isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Finding matches…</p>
          ) : matches.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No live matches yet — we'll follow up once we've reviewed your case.</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {matches.map((m) => (
                <Link
                  key={m.id}
                  to="/tutors/$tutorCode"
                  params={{ tutorCode: m.tutor_code }}
                  className="flex gap-4 rounded-2xl border border-border bg-card p-5 transition hover:border-[color:var(--brand-teal)]/40 hover:shadow-brand"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-muted">
                    {m.photo_url ? <img src={m.photo_url} alt={m.display_name} className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-foreground">{m.display_name}</p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Score {Math.round(m.score)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{m.district ?? "Any district"} · HK${m.hourly_rate}/hr</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
            <Button asChild className="bg-[color:var(--brand-navy)] text-white hover:bg-[color:var(--brand-royal)]"><Link to="/tutors">Browse all tutors</Link></Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
