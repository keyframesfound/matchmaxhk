import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Ban } from "lucide-react";

export const Route = createFileRoute("/_authenticated/post-case")({
  head: () => ({
    meta: [
      { title: "Case posting paused — MatchMax" },
      {
        name: "description",
        content: "Case posting is temporarily paused. Browse tutors instead.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PostCasePaused,
});

function PostCasePaused() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto flex max-w-3xl flex-col items-start px-4 py-16 sm:px-6 sm:py-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-700">
            <Ban className="h-3.5 w-3.5" />
            Case posting paused
          </div>
          <h1 className="mt-6 text-3xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
            We’re not accepting new cases right now.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Browsing tutors is still available, but case submission is temporarily disabled while we
            update the matching flow.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              asChild
              size="lg"
              className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]"
            >
              <Link to="/tutors">
                Browse tutors
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
