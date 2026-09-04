import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Asterisk,
  ArrowRight,
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
];

function HowItWorksPage() {
  return (
    <div className="how-it-works-paper flex min-h-screen flex-col text-[color:var(--ink)]">
      <SiteHeader className="!border-b-0 !bg-white/95 dark:!bg-[color:var(--surface)]" />
      <main className="flex-1">
        <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,4fr)] lg:gap-20">
            <div className="h-fit lg:sticky lg:top-24">
              <p className="text-sm font-bold text-[color:var(--brand-teal)]">How MatchMax works</p>
              <div className="relative mt-5 w-fit">
                <h1 className="max-w-lg text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">
                  A better way to make the right introduction.
                </h1>
                <Asterisk className="absolute -right-6 -top-4 h-5 w-5 text-[color:var(--brand-teal)] sm:-right-9 sm:-top-5 sm:h-7 sm:w-7" />
              </div>
              <p className="mt-6 max-w-md text-base leading-7 text-[color:var(--ink)]/65">
                We remove the uncertainty from finding exceptional tutors, courses, and education
                partners in Hong Kong.
              </p>
              <Link
                to="/tutors"
                className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[color:var(--ink)] transition-transform hover:translate-x-1"
              >
                Find a tutor <ArrowRight className="h-4 w-4 text-[color:var(--brand-teal)]" />
              </Link>
            </div>
            <ol className="border-t border-[color:var(--ink)]/15">
              {DIFFERENCE.map(({ icon: Icon, title, text }, index) => (
                <li
                  key={title}
                  className="group relative grid gap-5 border-b border-[color:var(--ink)]/15 py-8 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-8 sm:py-10"
                >
                  <div className="flex items-center justify-between sm:block">
                    <span className="flex h-11 w-11 items-center justify-center bg-[color:var(--brand-teal)]/10 text-sm font-black text-[color:var(--brand-link)]">
                      0{index + 1}
                    </span>
                    <Icon className="h-5 w-5 text-[color:var(--brand-teal)] transition-transform duration-300 group-hover:-translate-y-1 sm:mt-5" />
                  </div>
                  <div className="max-w-2xl">
                    <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h2>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--ink)]/68">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-transparent px-5 py-20 text-[#041344] dark:bg-[#10234f] dark:text-white sm:px-8 sm:py-28 lg:px-12">
          <div className="mx-auto max-w-[1440px]">
            <div className="grid gap-6 md:grid-cols-[0.7fr_1.3fr] md:items-end">
              <div>
                <p className="text-sm font-bold text-[#1FA8B6]">02 / The matching flow</p>
                <div className="mt-5 flex items-center gap-3 text-sm font-bold">
                  <Clock3 className="h-5 w-5" /> Within one business day
                </div>
              </div>
              <h2 className="max-w-3xl text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">
                One thoughtful process, for every side of the match.
              </h2>
            </div>
            <div className="mt-16 space-y-20">
              {AUDIENCES.map(({ eyebrow, title, icon: Icon, steps, link }, audienceIndex) => (
                <article
                  key={eyebrow}
                  className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,4fr)] lg:gap-20"
                >
                  <div className="h-fit lg:sticky lg:top-24">
                    <Icon className="h-7 w-7 text-[#1FA8B6]" />
                    <p className="mt-6 text-sm font-bold text-[#1FA8B6]">
                      0{audienceIndex + 1} / {eyebrow}
                    </p>
                    <h3 className="mt-3 text-3xl font-black leading-tight tracking-tight">
                      {title}
                    </h3>
                    <Link
                      to={link.to}
                      className="mt-8 inline-flex items-center text-sm font-bold transition-transform hover:translate-x-1"
                    >
                      {link.label} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </div>
                  <ol className="border-t border-current/20">
                    {steps.map(([number, stepTitle, text]) => (
                      <li
                        key={number}
                        className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-5 border-b border-current/20 py-7 sm:gap-8 sm:py-9"
                      >
                        <span className="flex h-11 w-11 items-center justify-center bg-[#1FA8B6]/15 text-sm font-black text-[#1FA8B6]">
                          {number}
                        </span>
                        <div>
                          <h4 className="text-xl font-black tracking-tight sm:text-2xl">
                            {stepTitle}
                          </h4>
                          <p className="mt-3 max-w-2xl text-sm leading-7 text-current/70">{text}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
          <div className="grid gap-10 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <MessageCircle className="h-7 w-7 text-[color:var(--brand-teal)]" />
              <h2 className="mt-7 max-w-4xl text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">
                The right match starts with a conversation.
              </h2>
              <p className="mt-6 max-w-xl text-base leading-7 text-[color:var(--ink)]/68">
                Whether you are looking for a tutor, building your teaching practice, or staffing a
                centre, our team makes every connection personal.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-[color:var(--ink)]/70">
              <Check className="h-4 w-4 text-[color:var(--brand-teal)]" /> Personal guidance, never
              robotic matching.
            </div>
          </div>
        </section>
      </main>
      <SiteFooter
        hideDivider
        className="!border-t-0 !bg-transparent dark:!bg-[color:var(--surface)]"
      />
    </div>
  );
}
