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
          "See how MatchMax connects families with verified tutors through a clear, human-led matching process.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: HowItWorksPage,
});

const STEPS = [
  {
    number: "01",
    title: "Tell us what you need",
    text: "Share the subject, level, lesson format, and schedule that matter to your family. A focused brief gives the right tutors enough context to respond well.",
  },
  {
    number: "02",
    title: "Compare verified tutors",
    text: "Review profiles with academic results, teaching experience, subjects, rates, and availability in one place before you make contact.",
  },
  {
    number: "03",
    title: "Start with the right fit",
    text: "Request a tutor through MatchMax, confirm the details, and move into lessons with a clear plan and a tutor who understands the goal.",
  },
];

const TRUST_POINTS = [
  "Academic results and qualifications are reviewed",
  "Profiles show subjects, lesson mode, rates, and experience",
  "Families can shortlist before requesting a tutor",
  "Tutor and family details stay clear from first contact",
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
        <section className="border-b border-[color:var(--brand-navy)]/10 bg-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:py-24">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--brand-navy)]/60">
                The MatchMax approach
              </p>
              <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-6xl sm:leading-[1.02]">
                A better way to find the right tutor.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--brand-navy)]/70">
                MatchMax makes tutoring easier to navigate: clear profiles, verified academic
                backgrounds, and a simple path from shortlist to first lesson.
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
              <div className="flex items-start justify-between gap-6 border-b border-[color:var(--brand-navy)]/10 pb-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--brand-navy)]/55">
                    One clear process
                  </p>
                  <p className="mt-3 text-2xl font-black text-[color:var(--brand-navy)]">
                    Less scrolling. More confidence.
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
                    Brief the goal
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-black text-[color:var(--brand-navy)]">02</p>
                  <p className="mt-1 text-sm leading-5 text-[color:var(--brand-navy)]/65">
                    Review the fit
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-black text-[color:var(--brand-navy)]">03</p>
                  <p className="mt-1 text-sm leading-5 text-[color:var(--brand-navy)]/65">
                    Start learning
                  </p>
                </div>
                <div>
                  <p className="text-3xl font-black text-[color:var(--brand-navy)]">HK</p>
                  <p className="mt-1 text-sm leading-5 text-[color:var(--brand-navy)]/65">
                    Built for Hong Kong
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
                From first search to first lesson.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[color:var(--brand-navy)]/68">
                Every step is designed to make the next decision easier, whether you are finding
                support for a student or building your tutoring practice.
              </p>
            </div>
            <div className="divide-y divide-[color:var(--brand-navy)]/10 border-y border-[color:var(--brand-navy)]/10">
              {STEPS.map((step) => (
                <article
                  key={step.number}
                  className="grid gap-4 py-7 sm:grid-cols-[72px_1fr] sm:gap-6"
                >
                  <p className="text-sm font-black tracking-[0.14em] text-[color:var(--brand-teal)]">
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

        <section className="border-y border-[color:var(--brand-navy)]/10 bg-white">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-20">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--brand-navy)] text-white">
                <BadgeCheck className="h-5 w-5" />
              </div>
              <h2 className="mt-6 text-3xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-4xl">
                Confidence comes from better information.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-[color:var(--brand-navy)]/68">
                A tutor profile should help a family make a considered choice. MatchMax keeps the
                important details visible and makes the path to contact straightforward.
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[#f8fafc] p-6 sm:p-8">
              <p className="text-sm font-bold text-[color:var(--brand-navy)]">
                What you can see on a profile
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
                For families
              </p>
              <h2 className="mt-3 text-2xl font-black text-[color:var(--brand-navy)]">
                Find support that fits.
              </h2>
              <p className="mt-3 text-sm leading-7 text-[color:var(--brand-navy)]/68">
                Search by subject, programme, lesson mode, and budget. Save promising tutors,
                compare profiles, and request the one that feels right.
              </p>
              <Link
                to="/tutors"
                className="mt-6 inline-flex items-center text-sm font-bold text-[color:var(--brand-navy)] underline underline-offset-4"
              >
                Browse tutors <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </article>
            <article className="rounded-2xl border border-[color:var(--brand-navy)]/10 bg-[color:var(--brand-navy)] p-7 text-white sm:p-9">
              <UserPlus className="h-5 w-5" />
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-white/60">
                For tutors
              </p>
              <h2 className="mt-3 text-2xl font-black">Teach on your terms.</h2>
              <p className="mt-3 text-sm leading-7 text-white/72">
                Present your strengths clearly, set the conditions that work for you, and connect
                with families looking for your subject expertise.
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

        <section className="border-t border-[color:var(--brand-navy)]/10 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--brand-navy)]/55">
                Ready when you are
              </p>
              <h2 className="mt-2 text-2xl font-black text-[color:var(--brand-navy)] sm:text-3xl">
                Start with a better shortlist.
              </h2>
            </div>
            <Button
              asChild
              className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]"
            >
              <Link to="/tutors">
                Find a tutor <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
