import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
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
import { motion } from "motion/react";

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
];

function HowItWorksPage() {
  return (
    <div className="how-it-works-paper flex min-h-screen flex-col text-[color:var(--ink)]">
      <SiteHeader className="!border-b-0 !bg-white/95 dark:!bg-[color:var(--surface)]" />
      <main className="flex-1">
        <section className="how-it-works-hero relative isolate min-h-[220px] overflow-hidden bg-[#06133e] text-white sm:min-h-[600px]">
          <div className="how-it-works-hero__image" aria-hidden="true" />
          <div className="relative mx-auto flex min-h-[220px] max-w-[1440px] flex-col px-5 py-10 sm:min-h-[600px] sm:px-8 lg:px-12">
            <motion.h1
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.12, ease: "easeOut" }}
              className="mt-auto max-w-6xl pb-8 font-serif text-[clamp(4.2rem,10vw,10rem)] leading-[0.9] tracking-tight text-white"
            >
              How it works
            </motion.h1>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
              className="flex justify-end"
            >
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-[#77E8EE] font-bold text-[#041344] hover:bg-white">
                  <Link to="/tutors">Find a tutor <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/35 bg-white/5 font-bold text-white hover:bg-white/15 hover:text-white">
                  <Link to="/join">Become a tutor</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
          <div className="grid gap-7 md:grid-cols-[0.45fr_1.2fr] md:items-end">
            <p className="text-sm font-bold text-[color:var(--brand-teal)]">01 / The MatchMax standard</p>
            <div>
              <h2 className="max-w-3xl text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">
                Built for a better introduction, <span className="font-serif font-normal italic">not more noise.</span>
              </h2>
              <p className="mt-6 max-w-xl text-sm leading-7 text-[color:var(--ink)]/65">Every part of the experience is designed to remove uncertainty, not add another layer of agency noise.</p>
            </div>
          </div>
          <div className="mt-20 grid gap-x-12 gap-y-16 md:grid-cols-2">
            {DIFFERENCE.map(({ icon: Icon, title, text }, index) => (
              <article
                key={title}
                className="group"
              >
                <div className="flex items-center gap-4">
                  <span className="text-sm font-black tracking-[0.14em] text-[color:var(--brand-teal)]">
                    0{index + 1}
                  </span>
                  <Icon className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-1" />
                </div>
                <h3 className="mt-6 text-2xl font-black tracking-tight">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[color:var(--ink)]/68">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-transparent px-5 py-20 text-[#041344] dark:bg-[#10234f] dark:text-white sm:px-8 sm:py-28 lg:px-12">
          <div className="mx-auto max-w-[1440px]">
            <div className="grid gap-6 md:grid-cols-[0.7fr_1.3fr] md:items-end">
              <div>
                <p className="text-sm font-bold text-[#1FA8B6]">02 / The matching flow</p>
                <div className="mt-5 flex items-center gap-3 text-sm font-bold"><Clock3 className="h-5 w-5" /> Within one business day</div>
              </div>
              <h2 className="max-w-3xl text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">One thoughtful process, for every side of the match.</h2>
            </div>
            <div className="mt-20 space-y-24">
              {AUDIENCES.map(({ eyebrow, title, icon: Icon, steps, link }, audienceIndex) => (
                <article key={eyebrow} className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
                  <div>
                    <Icon className="h-7 w-7 text-[#1FA8B6]" />
                    <p className="mt-6 text-sm font-bold text-[#1FA8B6]">0{audienceIndex + 1} / {eyebrow}</p>
                    <h3 className="mt-3 text-3xl font-black leading-tight tracking-tight">{title}</h3>
                    <Link
                      to={link.to}
                      className="mt-8 inline-flex items-center text-sm font-bold transition-transform hover:translate-x-1"
                    >
                      {link.label} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </div>
                  <ol className="grid gap-7 sm:grid-cols-2">
                    {steps.map(([number, stepTitle, text]) => (
                      <li
                        key={number}
                        className="grid grid-cols-[42px_1fr] gap-3"
                      >
                        <span className="font-serif text-3xl leading-none text-[#1FA8B6]">
                          {number}
                        </span>
                        <div>
                          <h4 className="text-base font-black">{stepTitle}</h4>
                          <p className="mt-2 text-sm leading-6 text-current/70">
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
              <Check className="h-4 w-4 text-[color:var(--brand-teal)]" /> Personal guidance, never robotic matching.
            </div>
          </div>
        </section>
      </main>
      <SiteFooter hideDivider className="!border-t-0 !bg-transparent dark:!bg-[color:var(--surface)]" />
    </div>
  );
}
