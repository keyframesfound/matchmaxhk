import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, FlaskConical, Trophy } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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
    title: "Tier 1",
    subtitle: "For quick final draft checks",
    planName: "Core Review",
    price: "HK$499",
    cadence: "+",
    features: [
      "IA/TOK: HK$499 (~US$64)",
      "EE: HK$599 (~US$77)",
      "Line-by-line audit + rubric scorecard",
      "Post-marking WhatsApp Q&A",
    ],
  },
  {
    title: "Tier 2",
    subtitle: "For section-level roadblocks",
    planName: "Consult",
    price: "HK$499",
    cadence: "+",
    features: [
      "IA/TOK: HK$499 (~US$64)",
      "EE: HK$599 (~US$77)",
      "Offline pre-read",
      "1-hour interactive Zoom call",
    ],
    featured: true,
  },
  {
    title: "Tier 3",
    subtitle: "For guided 30-day progress",
    planName: "Review & Mentorship",
    price: "HK$1,799",
    cadence: "/ month",
    features: [
      "IA/TOK: HK$1,799/mo (~US$230)",
      "EE: HK$2,399/mo (~US$307)",
      "Section-by-section reviews",
      "WhatsApp text + voice support",
    ],
  },
  {
    title: "Tier 4",
    subtitle: "For full start-to-submit support",
    planName: "Full-Cycle Package",
    price: "HK$2,499",
    cadence: "+",
    features: [
      "IA/TOK: HK$2,499 (~US$320)",
      "EE: HK$2,999 (~US$384)",
      "2x Consult Lessons + 1-Month Mentorship",
      "Deposit: HK$499 (~US$64)",
    ],
  },
];

function buildTierWhatsAppUrl(
  whatsappNumber: string | undefined,
  tierTitle: string,
  planName: string,
) {
  const digits = (whatsappNumber ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";

  const message = `Hi MatchMax, I am interested in ${tierTitle} (${planName}) from the consulting page. Could you share the next steps?`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function ConsultingPage() {
  const { data: whatsappNumber = "" } = useQuery({
    queryKey: ["settings", "whatsapp_number"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "whatsapp_number")
        .maybeSingle();
      if (error) throw error;
      const v = data?.value;
      return typeof v === "string" ? v : "";
    },
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="hero-startup-bg border-b border-border py-14 sm:py-18">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div
              className="consulting-hero-visual overflow-hidden rounded-3xl border border-border shadow-brand"
              style={{ backgroundImage: "url('/consulting-placeholder.svg')" }}
            >
              <div className="relative flex min-h-[360px] flex-col justify-end p-7 sm:min-h-[420px] sm:p-10">
                <div className="max-w-3xl rounded-3xl border border-white/30 bg-white/80 p-6 backdrop-blur-sm sm:p-8">
                  <h1 className="text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
                    Get your IAs, EEs, and TOK reviewed by 43+ IB top scorers at an affordable price.
                  </h1>
                  <p className="mt-4 max-w-4xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                    Stop overpaying for tutors to read your draft during lesson time.
                    You don't need someone watching you write. You need exact amendments and clear
                    action steps.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:grid-cols-2 sm:px-6">
            <div className="rounded-sm border border-[color:var(--brand-teal)]/20 bg-card p-6 shadow-[0_8px_24px_rgba(4,19,68,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(4,19,68,0.08)]">
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

            <div className="rounded-sm border border-[color:var(--brand-teal)]/20 bg-card p-6 shadow-[0_8px_24px_rgba(4,19,68,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(4,19,68,0.08)]">
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

            <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {tiers.map((tier) => (
                (() => {
                  const whatsappUrl = buildTierWhatsAppUrl(
                    whatsappNumber,
                    tier.title,
                    tier.planName,
                  );

                  return (
                    <article
                      key={tier.title}
                      className="group flex h-full flex-col overflow-hidden rounded-sm border border-[color:var(--brand-teal)]/20 bg-card shadow-[0_8px_24px_rgba(4,19,68,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(4,19,68,0.08)]"
                    >
                      <div className="bg-[color:var(--brand-teal)]/8 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--brand-teal)]">
                              {tier.title}
                            </p>
                            <h3 className="mt-1 text-2xl font-black leading-none text-[color:var(--brand-navy)]">
                              {tier.planName}
                            </h3>
                          </div>
                          {tier.featured ? (
                            <span className="rounded-full bg-[color:var(--brand-navy)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                              Popular
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{tier.subtitle}</p>
                      </div>

                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex items-end gap-1.5 text-[color:var(--brand-navy)]">
                          <span className="text-5xl font-black leading-none">{tier.price}</span>
                          <span className="pb-1 text-lg font-medium text-muted-foreground">{tier.cadence}</span>
                        </div>

                        <ul className="mt-5 space-y-2.5 text-sm text-foreground">
                          {tier.features.map((feature) => (
                            <li key={feature} className="flex items-start gap-2">
                              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-teal)]" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="border-t border-border bg-[color:var(--brand-teal)]/5 px-4 py-3">
                        {whatsappUrl ? (
                          <Button
                            asChild
                            className={`h-11 w-full rounded-sm text-base font-medium ${tier.featured ? "bg-[color:var(--brand-navy)] text-white hover:bg-[color:var(--brand-royal)]" : "border border-[color:var(--brand-teal)]/20 bg-white text-[color:var(--brand-navy)] hover:bg-slate-100"}`}
                            variant={tier.featured ? "default" : "outline"}
                          >
                            <a href={whatsappUrl} target="_blank" rel="noreferrer">
                              Contact WhatsApp
                            </a>
                          </Button>
                        ) : (
                          <Button
                            disabled
                            className="h-11 w-full rounded-sm text-base font-medium"
                            variant="outline"
                          >
                            WhatsApp unavailable
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })()
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

