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
  UserRoundCheck,
} from "lucide-react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works | MatchMax" },
      {
        name: "description",
        content:
          "Discover MatchMax's transparent, high-calibre tutoring matching for families, tutors, and education centres in Hong Kong — plus answers to the most frequently asked questions.",
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

const PARENT_STEPS: [string, string, string][] = [
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
  ["03", "Seamless connection", "Once you select a tutor, simply provide your WhatsApp contact."],
  [
    "04",
    "Instant group chat setup",
    "We immediately open a dedicated WhatsApp group with you and the tutor to coordinate logistics—no middleman delays.",
  ],
];

const TUTOR_STEPS: [string, string, string][] = [
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
];

const FAQ_FOR_TUTORS = [
  {
    q: "How do I get paid?",
    a: "Parents pay you directly for your lessons via your preferred payment method. After parents pay you, you pay MatchMax our agency commission for the 1st and 11th lesson of that student contract. All earnings for all other lessons are 100% yours.",
  },
  {
    q: "How many days does it usually take to find students?",
    a: "Matching speed depends on subject demand, your profile quality, and availability. Many tutors receive relevant student matching requests within 1 to 2 weeks.",
  },
  {
    q: "What are typical tutoring rates?",
    a: "Usual market rates typically range between HK$300 to HK$600 per hour. However, rates vary depending on lesson mode (online vs. in-person), duration, level, subject complexity, and your academic background. Tutors can discuss and negotiate rates directly with parents to agree on a fair fee.",
  },
  {
    q: "Do I need teaching experience to join?",
    a: "Prior experience helps, but strong academic results, clear communication skills, and a complete profile are equally important for verification and student matching.",
  },
  {
    q: "Can I teach both online and in person?",
    a: "Yes. You can set your preferred lesson modes and target locations in your profile and update them anytime as your schedule changes.",
  },
  {
    q: "What happens if a parent doesn't pay me?",
    a: "While payment arrangements are made directly between you and the parent, MatchMax takes payment protection seriously. If a parent fails to pay for completed lessons, we will intervene, follow up directly with the parent, and use all appropriate lawful methods to help you recover your unpaid fees.",
  },
];

const FAQ_FOR_PARENTS = [
  {
    q: "Can hourly rates be negotiated?",
    a: "Yes, rates can be negotiated, but any adjustments depend entirely on the tutor's willingness and policy. Factors such as lesson frequency, online vs. in-person mode, travel distance, and lesson length may give room for discussion directly with the tutor.",
  },
  {
    q: "Can I arrange a trial lesson before committing to a regular schedule?",
    a: "Yes. Parents are welcome to request an initial single trial lesson. Whether a trial lesson is offered and its specific terms (paid or discounted) depend entirely on the individual tutor's willingness and policy, which you can confirm directly before starting.",
  },
  {
    q: "How does matching work?",
    a: "You have two straightforward options: you can click forward directly on any tutor's profile card to request that specific tutor, or reach out to our WhatsApp hotline and tell us exactly what you are looking for so we can match you. Once confirmed, we connect you directly with the tutor to finalize lesson times.",
  },
  {
    q: "How does MatchMax verify tutor qualifications and grades?",
    a: "Every tutor on our platform must submit official supporting documentation—such as exam score certificates, diplomas, or university transcripts. Our team verifies these credentials before any profile goes live.",
  },
  {
    q: "How do payments work between parents and tutors?",
    a: "Tuition is paid directly to the tutor based on the agreed hourly rate and schedule. MatchMax does not hold or handle your tuition fees, keeping the payment process direct and transparent.",
  },
];

function AudienceSection({
  eyebrow,
  audience,
  title,
  icon: Icon,
  steps,
  link,
  className,
  numberClassName,
  accentClassName,
}: {
  eyebrow: string;
  audience: string;
  title: string;
  icon: typeof Search;
  steps: [string, string, string][];
  link: { to: "/tutors" | "/join"; label: string };
  className: string;
  numberClassName: string;
  accentClassName: string;
}) {
  return (
    <section className={className}>
      <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <article className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,4fr)] lg:gap-20">
          <div className="h-fit lg:sticky lg:top-24">
            <Icon className={`h-7 w-7 ${accentClassName}`} />
            <p className={`mt-6 text-sm font-bold ${accentClassName}`}>{eyebrow}</p>
            <h3 className="mt-3 text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              {audience}
            </h3>
            <p className="mt-4 max-w-md text-xl font-bold leading-snug tracking-tight sm:text-2xl">
              {title}
            </p>
            <Link
              to={link.to}
              className="mt-8 inline-flex items-center text-sm font-bold transition-transform hover:translate-x-1"
            >
              {link.label} <ArrowRight className={`ml-2 h-4 w-4 ${accentClassName}`} />
            </Link>
          </div>
          <ol className="border-t border-current/20">
            {steps.map(([number, stepTitle, text]) => (
              <li
                key={number}
                className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-5 border-b border-current/20 py-7 sm:gap-8 sm:py-9"
              >
                <span
                  className={`flex h-11 w-11 items-center justify-center text-sm font-black ${numberClassName}`}
                >
                  {number}
                </span>
                <div>
                  <h4 className="text-xl font-black tracking-tight sm:text-2xl">{stepTitle}</h4>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-current/70">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </article>
      </div>
    </section>
  );
}

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

        <section className="px-5 py-20 text-[#041344] dark:bg-[#10234f] dark:text-white sm:px-8 sm:py-28 lg:px-12">
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
          </div>
        </section>

        <AudienceSection
          eyebrow="For parents & students"
          audience="For Parents"
          title="The highest calibre of educational matching, completely free."
          icon={Search}
          steps={PARENT_STEPS}
          link={{ to: "/tutors", label: "Find a tutor" }}
          className="bg-[#E7F6F8] text-[#041344] dark:bg-[#0C2B4E] dark:text-white"
          numberClassName="bg-[#1FA8B6]/15 text-[#1FA8B6]"
          accentClassName="text-[#1FA8B6]"
        />

        <AudienceSection
          eyebrow="For tutors"
          audience="For Tutors"
          title="Maximise your earning potential with Hong Kong's most tutor-friendly platform."
          icon={UserRoundCheck}
          steps={TUTOR_STEPS}
          link={{ to: "/join", label: "Apply as a tutor" }}
          className="bg-[#041344] text-white dark:bg-[#041344] dark:text-white"
          numberClassName="bg-[#77E8EE]/15 text-[#77E8EE]"
          accentClassName="text-[#77E8EE]"
        />

        <section
          id="faq"
          className="mx-auto max-w-[1440px] scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28 lg:px-12"
        >
          <div className="mx-auto max-w-4xl">
            <p className="text-sm font-bold text-[color:var(--brand-teal)]">03 / Good to know</p>
            <h2 className="mt-3 text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">
              Frequently Asked Questions
            </h2>

            <div className="mt-14">
              <h3 className="flex items-center gap-2 text-2xl font-black tracking-tight">
                <UserRoundCheck
                  className="h-6 w-6 text-[color:var(--brand-teal)]"
                  aria-hidden="true"
                />
                For Tutors
              </h3>
              <div className="mt-5 rounded-[var(--radius-panel)] border border-[color:var(--ink)]/12 bg-[color:var(--surface)] px-5 py-2 shadow-[var(--shadow-brand)] sm:px-8">
                <Accordion type="single" collapsible className="w-full">
                  {FAQ_FOR_TUTORS.map((item, index) => (
                    <AccordionItem
                      key={item.q}
                      value={`tutor-faq-${index}`}
                      className="border-[color:var(--ink)]/10"
                    >
                      <AccordionTrigger className="py-5 text-left text-lg font-bold text-[color:var(--ink)] hover:no-underline sm:text-xl">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="pb-5 text-base leading-relaxed text-[color:var(--ink)]/70">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>

            <div className="mt-14">
              <h3 className="flex items-center gap-2 text-2xl font-black tracking-tight">
                <Search className="h-6 w-6 text-[color:var(--brand-teal)]" aria-hidden="true" />
                For Parents
              </h3>
              <div className="mt-5 rounded-[var(--radius-panel)] border border-[color:var(--ink)]/12 bg-[color:var(--surface)] px-5 py-2 shadow-[var(--shadow-brand)] sm:px-8">
                <Accordion type="single" collapsible className="w-full">
                  {FAQ_FOR_PARENTS.map((item, index) => (
                    <AccordionItem
                      key={item.q}
                      value={`parent-faq-${index}`}
                      className="border-[color:var(--ink)]/10"
                    >
                      <AccordionTrigger className="py-5 text-left text-lg font-bold text-[color:var(--ink)] hover:no-underline sm:text-xl">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="pb-5 text-base leading-relaxed text-[color:var(--ink)]/70">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
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
