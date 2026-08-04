import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, FlaskConical, Trophy } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/consulting")({
  head: () => ({
    meta: [
      { title: "IB IA, EE & TOK Consulting | MatchMax" },
      {
        name: "description",
        content:
          "Get IA, EE and TOK drafts reviewed by top IB scorers with line-by-line offline feedback, consult lessons and mentorship packages.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "IB IA, EE & TOK Consulting | MatchMax" },
      {
        property: "og:description",
        content:
          "Choose from Core Review, Consult Lesson, 1-Month Mentorship, or Full-Cycle Package for IA, EE and TOK support.",
      },
      { property: "og:url", content: "https://www.maxmatch.app/consulting" },
    ],
    links: [{ rel: "canonical", href: "https://www.maxmatch.app/consulting" }],
  }),
  component: ConsultingPage,
});

const tiers = [
  {
    title: "Tier 1: Core Review (1-Time Deep Audit)",
    bestFor: "Quick final sanity check on full or partial drafts.",
    details:
      "Line-by-line audit + predicted rubric scorecard + post-marking WhatsApp Q&A.",
    pricing: "IA/TOK: HK$499 (~US$64) | EE: HK$599 (~US$77)",
  },
  {
    title: "Tier 2: Consult Lesson",
    bestFor: "Fixing RQs, outlines, or specific section roadblocks.",
    details: "Offline pre-read + 1-hour interactive Zoom call.",
    pricing: "IA/TOK: HK$499 (~US$64) | EE: HK$599 (~US$77)",
  },
  {
    title: "Tier 3: Progress Review & Mentorship (1 Month)",
    bestFor: "Step-by-step guidance as you write over 30 days.",
    details:
      "1 month of section-by-section reviews + ongoing WhatsApp text and voice access.",
    pricing: "IA/TOK: HK$1,799/mo (~US$230) | EE: HK$2,399/mo (~US$307)",
  },
  {
    title: "Tier 4: Full-Cycle Package (Blank Page to Submission)",
    bestFor: "Complete end-to-end guidance from topic choice to final draft.",
    details: "2x Consult Lessons + 1 Month Mentorship + 1x Final Core Review.",
    pricing: "IA/TOK: HK$2,499 (~US$320) | EE: HK$2,999 (~US$384)",
    note: "Secure your spot with a HK$499 (~US$64) deposit upfront.",
  },
];

function ConsultingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="hero-startup-bg border-b border-border py-14 sm:py-18">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="consulting-hero-visual overflow-hidden rounded-3xl border border-border shadow-brand">
              <div className="relative flex min-h-[360px] flex-col justify-end p-7 sm:min-h-[420px] sm:p-10">
                <div className="max-w-3xl rounded-3xl border border-white/30 bg-white/80 p-6 backdrop-blur-sm sm:p-8">
                  <h1 className="text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
                    Get your IAs, EEs, and TOK reviewed by 43+ IB top scorers at an affordable price.
                  </h1>
                  <p className="mt-4 max-w-4xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                    Stop paying around HK$800/hr for tutors to read your draft during live lessons.
                    You do not need someone watching you write. You need exact amendments and clear
                    action steps.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:grid-cols-2 sm:px-6">
            <div className="rounded-3xl border border-[color:var(--brand-teal)]/15 bg-card p-6 shadow-[0_10px_24px_rgba(4,19,68,0.04)]">
              <div className="flex items-center gap-2 text-[color:var(--brand-navy)]">
                <Trophy className="h-5 w-5 text-[color:var(--brand-teal)]" />
                <h2 className="text-2xl font-black tracking-tight">Proven Results</h2>
              </div>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-teal)]" />
                  6 students achieved Grade A in TOK, including 10/10 TOK essays.
                </li>
                <li className="flex gap-2">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-teal)]" />
                  5 students achieved Grade 7 in Biology or Chemistry IAs.
                </li>
              </ul>
            </div>

            <div className="rounded-3xl border border-[color:var(--brand-teal)]/15 bg-card p-6 shadow-[0_10px_24px_rgba(4,19,68,0.04)]">
              <div className="flex items-center gap-2 text-[color:var(--brand-navy)]">
                <FlaskConical className="h-5 w-5 text-[color:var(--brand-teal)]" />
                <h2 className="text-2xl font-black tracking-tight">Elite Tutor Guarantee</h2>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Every tutor is strictly verified to have achieved an overall Grade 7 in the subject
                offered, plus a Grade 7 or Grade A in their own IA, EE, or TOK with near-perfect
                component scores.
              </p>
            </div>
          </div>
        </section>

        <section className="pb-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 className="text-3xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
              Service Tiers and Pricing
            </h2>

            <div className="mt-7 grid gap-5 lg:grid-cols-2">
              {tiers.map((tier) => (
                <article
                  key={tier.title}
                  className="rounded-3xl border border-border bg-card p-6 shadow-[0_10px_24px_rgba(4,19,68,0.04)]"
                >
                  <h3 className="text-xl font-black text-[color:var(--brand-navy)]">{tier.title}</h3>
                  <p className="mt-3 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">Best for:</span> {tier.bestFor}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">{tier.details}</p>
                  <p className="mt-4 text-sm font-semibold text-[color:var(--brand-navy)]">
                    {tier.pricing}
                  </p>
                  {tier.note ? (
                    <p className="mt-3 rounded-xl border border-[color:var(--brand-teal)]/20 bg-[color:var(--brand-teal)]/10 px-3 py-2 text-xs font-semibold text-[color:var(--brand-navy)]">
                      {tier.note}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                asChild
                className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]"
              >
                <Link to="/auth">
                  Start with MatchMax
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="font-bold">
                <Link to="/tutors">Browse tutors</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
