import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Check, Search, ShieldCheck, UserPlus } from "lucide-react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works | MatchMax" },
      {
        name: "description",
        content:
          "See how MatchMax helps tutors build a credible profile, reach the right families, and grow their tutoring practice.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: HowItWorksPage,
});

const STEPS = [
  {
    number: "01",
    title: "Apply to join MatchMax",
    text: "Share the subjects, levels, rates, and experience you want families to see. A complete application gives our team the context to review your profile properly.",
  },
  {
    number: "02",
    title: "Get verified",
    text: "Our team reviews your academic background, qualifications, and profile details before your tutor profile goes live.",
  },
  {
    number: "03",
    title: "Receive student requests",
    text: "Families can discover your strengths, review your profile, and contact you when your subjects, rates, and availability are a good fit.",
  },
];

const TRUST_POINTS = [
  "Academic results and qualifications are reviewed",
  "Your profile shows subjects, lesson mode, rates, and experience",
  "Families can understand your strengths before they enquire",
  "You stay in control of your availability and lesson preferences",
];

const TUTOR_BENEFITS = [
  "A professional profile that explains what you teach",
  "Control over your subjects, rates, and availability",
  "Relevant requests instead of broad, unqualified enquiries",
];

function HowItWorksPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc] text-[color:var(--brand-navy)]">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-[#f8fafc]">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:py-24">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--brand-navy)]/60">
                How MatchMax works for tutors
              </p>
              <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-6xl sm:leading-[1.02]">
                Build a tutoring profile families can trust.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--brand-navy)]/70">
                MatchMax gives strong tutors a clearer way to present their experience, connect with
                relevant families, and build a flexible tutoring practice.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  asChild
                  className="bg-[color:var(--brand-navy)] font-bold text-white shadow-brand hover:bg-[color:var(--brand-royal)]"
                >
                  <Link to="/tutors">
                    Find a tutor <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-[color:var(--brand-navy)]/20 bg-white font-bold text-[color:var(--brand-navy)] hover:bg-[color:var(--brand-navy)]/5"
                >
                  <Link to="/join">
                    Become a Tutor <UserPlus className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--brand-navy)]/12 bg-[#f8fafc] p-6 sm:p-8">
              <div className="flex items-start justify-between gap-6 pb-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--brand-navy)]/55">
                    One clear process
                  </p>
                  <p className="mt-3 text-2xl font-black text-[color:var(--brand-navy)]">
                    From application to first request.
                  </p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--brand-navy)] text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 pt-6">
                <div>
                  <p className="text-3xl font-black text-[color:var(--brand-navy)]">01</p>
                  <p className="mt-1 text-sm leading-5 text-[color:var(--brand-navy)]/65">
                    Submit your profile
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-black text-[color:var(--brand-navy)]">02</p>
                  <p className="mt-1 text-sm leading-5 text-[color:var(--brand-navy)]/65">
                    Complete verification
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-black text-[color:var(--brand-navy)]">03</p>
                  <p className="mt-1 text-sm leading-5 text-[color:var(--brand-navy)]/65">
                    Meet the right family
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-black text-[color:var(--brand-navy)]">HK</p>
                  <p className="mt-1 text-sm leading-5 text-[color:var(--brand-navy)]/65">
                    Built for tutors
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
            <div className="max-w-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--brand-navy)]/55">
                How it works
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
                From application to first request.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[color:var(--brand-navy)]/68">
                Every step is designed to make your next move clear, from submitting your
                application to receiving a request that matches what you teach.
              </p>
            </div>
            <div>
              {STEPS.map((step) => (
                <article
                  key={step.number}
                  className="grid gap-4 py-7 sm:grid-cols-[72px_1fr] sm:gap-6"
                >
                  <p className="text-sm font-black tracking-[0.14em] text-[color:var(--brand-navy)]">
                    {step.number}
                  </p>
                  <div>
                    <h3 className="text-xl font-bold text-[color:var(--brand-navy)]">
                      {step.title}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--brand-navy)]/68">
                      {step.text}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f8fafc]">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-20">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--brand-navy)] text-white">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <h2 className="mt-6 text-3xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
                Your profile should do the explaining.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[color:var(--brand-navy)]/68">
                Families make better enquiries when they can quickly understand your academic
                background, subjects, teaching style, and availability.
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[#f8fafc] p-6 sm:p-8">
              <p className="text-sm font-bold text-[color:var(--brand-navy)]">
                What your profile makes clear
              </p>
              <div className="mt-5 space-y-4">
                {TRUST_POINTS.map((point) => (
                  <div key={point} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]" />
                    <p className="text-sm leading-6 text-[color:var(--brand-navy)]/72">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-5 lg:grid-cols-2">
            <article className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-white p-7 sm:p-9">
              <Search className="h-5 w-5 text-[color:var(--brand-navy)]" />
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--brand-navy)]/55">
                Your profile
              </p>
              <h2 className="mt-3 text-2xl font-black text-[color:var(--brand-navy)]">
                Show what makes you a strong tutor.
              </h2>
              <p className="mt-3 text-sm leading-7 text-[color:var(--brand-navy)]/68">
                Present your strongest subjects, academic results, experience, rates, and preferred
                lesson format in one professional profile.
              </p>
              <Link
                to="/tutors"
                className="mt-6 inline-flex items-center text-sm font-bold text-[color:var(--brand-navy)] underline underline-offset-4"
              >
                See tutor profiles <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </article>
            <article className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-navy)] p-7 text-white sm:p-9">
              <UserPlus className="h-5 w-5" />
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-white">
                Your opportunities
              </p>
              <h2 className="mt-3 text-2xl font-black text-white">Receive better-fit requests.</h2>
              <p className="mt-3 text-sm leading-7 text-white/72">
                When your profile is clear, families can find you for the subjects and lesson
                formats you are best placed to teach.
              </p>
              <div className="mt-6 space-y-3">
                {TUTOR_BENEFITS.map((benefit) => (
                  <div
                    key={benefit}
                    className="flex items-start gap-3 text-sm leading-6 text-white/80"
                  >
                    <Check className="mt-1 h-4 w-4 shrink-0" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
              <Link
                to="/join"
                className="mt-7 inline-flex items-center text-sm font-bold text-white underline underline-offset-4"
              >
                Become a Tutor <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </article>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
