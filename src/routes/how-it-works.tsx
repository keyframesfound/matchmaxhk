import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CircleDollarSign,
  Clock3,
  GraduationCap,
  Handshake,
  MessageCircle,
  Search,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";

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
          "Discover MatchMax's transparent, high-calibre tutoring matching for families, tutors, and education centres in Hong Kong.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: HowItWorksPage,
});

const DIFFERENCE = [
  {
    icon: GraduationCap,
    title: "Top 1% elite screening",
    text: "We demand academic excellence. Our network consists of top-tier talent, including candidates with IB 40+, DSE Best 5 30+, and official examiners. Every profile is rigorously verified so parents are paired with authentic, high-calibre educators.",
  },
  {
    icon: CircleDollarSign,
    title: "The most transparent fees in Hong Kong",
    text: "Traditional agencies typically charge tutors half of their first month's tuition—up to a full two weeks of pay. MatchMax charges a radically transparent, one-time flat fee of just 1.5 lessons, so top talent keeps more of what they earn.",
  },
  {
    icon: Building2,
    title: "Zero-cost B2B placements",
    text: "MatchMax charges educational partners $0, delivering elite, verified staffing solutions at unprecedented speed and zero risk.",
  },
  {
    icon: Handshake,
    title: "Student-founded expertise",
    text: "Built by university students, we understand the logistics of private tutoring. We consider every application individually and provide personalised, manual guidance to ensure the perfect fit.",
  },
];

const AUDIENCES = [
  {
    eyebrow: "For parents & students",
    title: "The highest calibre of educational matching, completely free.",
    icon: Search,
    steps: [
      [
        "01",
        "Search or connect",
        "Browse using advanced filters, or send your exact requirements to our WhatsApp hotline.",
      ],
      [
        "02",
        "Review the best",
        "Within one business day, our team curates and sends profiles of elite, verified candidates. Review their subjects taught, achievements, and experience independently.",
      ],
      [
        "03",
        "Seamless connection",
        "Once you select a tutor, simply provide your WhatsApp contact.",
      ],
      [
        "04",
        "Instant group chat setup",
        "We immediately open a dedicated WhatsApp group with you and the tutor to coordinate logistics—no middleman delays.",
      ],
    ],
    link: { to: "/tutors" as const, label: "Find a tutor" },
  },
  {
    eyebrow: "For tutors",
    title: "Maximise your earning potential with Hong Kong's most tutor-friendly platform.",
    icon: UserRoundCheck,
    steps: [
      [
        "01",
        "Apply & prove your worth",
        "Submit your application online. We strictly verify academic credentials and notify you of acceptance within one business day.",
      ],
      [
        "02",
        "Anonymous promotion",
        "Once accepted, you receive a unique identification code. We market your profile across our website, social media, and elite B2B partner networks while keeping your real name private.",
      ],
      [
        "03",
        "Receive premium case cards",
        "We bring opportunities to you: detailed case cards for top-tier private and centre-based jobs. You always have the freedom to accept or decline.",
      ],
      [
        "04",
        "A fair commission",
        "Our service is free until you secure a client. Then, the fee is a simple 1.5-lesson flat rate—no hidden fees or ongoing percentage cuts.",
      ],
    ],
    link: { to: "/join" as const, label: "Apply as a tutor" },
  },
  {
    eyebrow: "For agencies & educational centres",
    title: "Hong Kong's most elite tutoring database for your centre, absolutely free.",
    icon: Building2,
    steps: [
      [
        "01",
        "Submit your vacancies",
        "Contact our business team with your staffing requirements for part-time or full-time instructional roles.",
      ],
      [
        "02",
        "Rapid 24-hour shortlisting",
        "Our active pool of heavily vetted, top-percentile tutors—including IB 40+ and DSE 30+ candidates—delivers a curated shortlist within one business day.",
      ],
      [
        "03",
        "Review & interview",
        "Assess a candidate's subjects taught, achievements, and experience, then proceed directly to interviewing your chosen applicants.",
      ],
      [
        "04",
        "Zero placement fees",
        "We handle recruitment and matching at exactly no cost to your business: a completely risk-free way to scale your centre.",
      ],
    ],
    link: { to: "/tutors" as const, label: "Explore our tutors" },
  },
];

function HowItWorksPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-[color:var(--ink)] dark:bg-[color:var(--surface)]">
      <SiteHeader className="!border-b-0 !bg-white dark:!bg-[color:var(--surface)]" />
      <main className="flex-1">
        <section className="overflow-hidden bg-white dark:bg-[color:var(--surface)]">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:py-28">
            <div>
              <p className="font-serif text-lg italic tracking-wide text-[color:var(--ink)]/70">
                The MatchMax Difference
              </p>
              <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-tight sm:text-6xl sm:leading-[1.02]">
                A new standard for tutoring in Hong Kong.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--ink)]/68">
                We believe the tutoring industry should be defined by transparency, speed, and
                uncompromising quality. MatchMax is built to deliver exactly that.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  asChild
                  className="bg-white font-bold text-[color:var(--ink)] hover:bg-white/90 dark:bg-[color:var(--surface-invert)] dark:text-white dark:hover:bg-[color:var(--surface-invert-hover)]"
                >
                  <Link to="/tutors">
                    Find a tutor <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-[color:var(--ink)]/20 bg-transparent font-bold text-[color:var(--ink)] hover:bg-[color:var(--ink)]/5 hover:text-[color:var(--ink)]"
                >
                  <Link to="/join">Become a tutor</Link>
                </Button>
              </div>
            </div>
            <div className="pl-6 sm:pl-10 lg:mt-14">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[color:var(--ink)]/55">
                Our promise
              </p>
              <p className="mt-5 font-serif text-3xl leading-tight italic sm:text-4xl">
                “Better matches begin with higher standards.”
              </p>
              <div className="mt-10 flex items-center gap-3 text-sm text-[color:var(--ink)]/70">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                Every tutor profile is rigorously verified.
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="max-w-2xl">
            <p className="font-serif text-lg italic tracking-wide text-[color:var(--ink)]/70">
              Why MatchMax
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              A better model, by design.
            </h2>
          </div>
          <div className="mt-12 grid md:grid-cols-2">
            {DIFFERENCE.map(({ icon: Icon, title, text }, index) => (
              <article
                key={title}
                className="py-8 md:px-8 md:odd:pl-0 md:even:pr-0"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm font-black tracking-[0.14em] text-[color:var(--ink)]/45">
                    0{index + 1}
                  </span>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 text-xl font-black">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[color:var(--ink)]/68">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-white dark:bg-[color:var(--surface)]">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="flex max-w-2xl items-start gap-4">
              <Clock3 className="mt-1 h-6 w-6 shrink-0" />
              <div>
                <p className="font-serif text-lg italic tracking-wide text-[color:var(--ink)]/70">
                  One business day
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                  Clear steps for every side of the match.
                </h2>
              </div>
            </div>
            <div className="mt-14 space-y-16">
              {AUDIENCES.map(({ eyebrow, title, icon: Icon, steps, link }) => (
                <article key={eyebrow} className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
                  <div>
                    <Icon className="h-6 w-6" />
                    <p className="mt-6 text-sm font-bold uppercase tracking-[0.16em] text-[color:var(--ink)]/55">
                      {eyebrow}
                    </p>
                    <h3 className="mt-3 text-2xl font-black tracking-tight">{title}</h3>
                    <Link
                      to={link.to}
                      className="mt-6 inline-flex items-center text-sm font-bold underline underline-offset-4"
                    >
                      {link.label} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </div>
                  <ol>
                    {steps.map(([number, stepTitle, text]) => (
                      <li
                        key={number}
                        className="grid gap-3 py-5 sm:grid-cols-[52px_1fr] sm:gap-5"
                      >
                        <span className="text-sm font-black tracking-[0.14em] text-[color:var(--ink)]/50">
                          {number}
                        </span>
                        <div>
                          <h4 className="font-bold">{stepTitle}</h4>
                          <p className="mt-1.5 text-sm leading-6 text-[color:var(--ink)]/68">
                            {text}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid gap-8 pl-6 sm:grid-cols-[1fr_auto] sm:items-end sm:pl-10">
            <div>
              <MessageCircle className="h-6 w-6" />
              <h2 className="mt-6 text-3xl font-black tracking-tight sm:text-4xl">
                The right match starts with a conversation.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--ink)]/68">
                Whether you are looking for a tutor, building your teaching practice, or staffing a
                centre, our team makes every connection personal.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold">
              <Check className="h-4 w-4" /> Personal guidance, never robotic matching.
            </div>
          </div>
        </section>
      </main>
      <SiteFooter hideDivider className="!border-t-0 !bg-white dark:!bg-[color:var(--surface)]" />
    </div>
  );
}
