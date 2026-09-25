import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Briefcase, ChevronRight, UserRoundCheck } from "lucide-react";

import { PageBackButton } from "@/components/layout/page-back-button";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicPage } from "@/components/layout/PublicPage";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tutor-playbook")({
  head: () => ({
    meta: [
      { title: "Tutor Playbook: Parent Relations & Etiquette | MatchMax" },
      {
        name: "description",
        content:
          "The MatchMax Tutor Playbook — real-world scripts and protocols for tutors on parent relations, etiquette, logistics, and admin, from onboarding to locking in a weekly slot.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Tutor Playbook: Parent Relations & Etiquette | MatchMax" },
      {
        property: "og:description",
        content:
          "Real-world scripts and protocols for MatchMax tutors: win over parents, master logistics, deliver post-lesson value, and coordinate with MatchMax Admin.",
      },
      { property: "og:url", content: "https://matchmax.hk/tutor-playbook" },
    ],
  }),
  component: TutorPlaybookPage,
});

type ScriptCardData = { label?: string; text: string };

type TemplateCardData = { label: string; lines: string[] };

type Scenario = {
  title: string;
  action: string;
  scripts: ScriptCardData[];
  escalation?: string;
};

type Block =
  | { kind: "p"; text: string }
  | { kind: "note"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "scripts"; items: ScriptCardData[] }
  | { kind: "say"; dont: string; do: string }
  | { kind: "templates"; cards: [TemplateCardData, TemplateCardData] }
  | { kind: "scenarios"; rows: Scenario[] };

type Section = { id: string; shortTitle: string; title: string; blocks: Block[] };

const SECTIONS: Section[] = [
  {
    id: "first-impression",
    shortTitle: "Onboarding",
    title: "First impressions: owning the onboarding",
    blocks: [
      {
        kind: "p",
        text: "The moment you are matched, you are the manager of this educational relationship. You must be warm, reliable, and professional, acknowledging new family introductions within 30 minutes when available to reassure parents.",
      },
      { kind: "h3", text: "The Introduction Script" },
      {
        kind: "scripts",
        items: [
          {
            text: "Hello [Parent] and [Student]! I'm [Your Name], and I'm thrilled to be matched with you. I specialize in [Subject/Curriculum] and my goal is to make sure [Student] feels completely confident heading into their exams. To ensure our first lesson is perfectly tailored, I have two quick requests before we begin. ☺️",
          },
        ],
      },
      { kind: "h3", text: "Demand the Pre-Lesson Alignment" },
      {
        kind: "p",
        text: "Do not walk into lesson one blind. Thinking a step ahead requires data. Request these two check-ins proactively:",
      },
      {
        kind: "ul",
        items: [
          "**The 5-Minute Parent Call:** Ask to call the parent to uncover their *true* needs. Listen to both the student's and parent's priorities, as they are not always the same. Ask: “What is your ultimate goal here? Are we fixing foundational gaps, pushing for a top-tier grade, or just trying to keep up with schoolwork?”",
          "**The 15-Minute Student Chat:** Request a brief chat with the student before the first lesson. Review any information already provided and ask about their current topics, upcoming deadlines, and recent marked work. This allows you to vet and allocate exact exercises beforehand.",
        ],
      },
      { kind: "h3", text: "Tone & Emojis" },
      {
        kind: "p",
        text: "Aim to reply to messages within 1–2 hours, sending non-urgent messages between 08:30 and 21:30 in the student's local time zone to respect boundaries.",
      },
      {
        kind: "ul",
        items: [
          "**The Vibe:** Polite, clear, respectful, and authoritative yet warm. You are an expert consultant.",
          "**Emojis:** Friendly emojis (🙏🏻, 🙇‍♂️, 🫡, ☺️) are highly encouraged to build rapport and soften texts, but avoid them entirely in serious or sensitive conversations like billing disputes.",
        ],
      },
    ],
  },
  {
    id: "logistics",
    shortTitle: "Logistics",
    title: "Logistics & the “always-a-step-ahead” mindset",
    blocks: [
      {
        kind: "p",
        text: "Never assume a parent remembers the schedule. If they forget, you waste your time.",
      },
      { kind: "h3", text: "The “Gentle Reminder” Protocol" },
      {
        kind: "scripts",
        items: [
          {
            label: "The day before",
            text: "Hi [Parent], gentle reminder that [Student] has a lesson tomorrow at [Time]. I've already uploaded tomorrow's exercises to our shared Google Drive folder so they can take a look! 🫡",
          },
          {
            label: "2–3 hours before",
            text: "Hi! See you and [Student] online in a few hours at [Time]. Please have [Specific Material] ready. 🙏🏻",
          },
        ],
      },
      { kind: "h3", text: "Preparation & Punctuality" },
      {
        kind: "ul",
        items: [
          "Finish preparation and equipment checks 10 minutes before the start. Be ready online a few minutes early, or arrive at in-person locations exactly at the agreed time.",
          "Always use a consistent Zoom link for each student and pin it in the chat so it's never lost.",
          "Maintain a separate Google Drive folder for each student containing notes, resources, and homework, and pin this link in the chat as well.",
        ],
      },
    ],
  },
  {
    id: "post-lesson",
    shortTitle: "Post-lesson value",
    title: "Post-lesson value & locking in the schedule",
    blocks: [
      {
        kind: "p",
        text: "The summary you give after a lesson dictates whether a parent thinks you are worth the money.",
      },
      { kind: "h3", text: "Translating Academic Jargon for Parents" },
      {
        kind: "p",
        text: "Many parents have never taken the IB, DSE, or A-Levels. If you use heavy academic terms (e.g., “SBA,” “TOK,” “Paper 1 Section B”), they will feel alienated. You must act as a translator.",
      },
      {
        kind: "say",
        dont: "Her IB IA lacks epistemic justification and fails the Criterion C rubric.",
        do: "For her upcoming major coursework (which counts for 20% of her final grade!), the examiner wants to see her argue *how* we know things. She has great ideas, so our next step is just organizing them to hit the grading rubric perfectly. 🫡",
      },
      {
        kind: "p",
        text: "**The Rule of 3:** When explaining progress, tell the parent: 1) What the task is in plain English, 2) Why it matters for their final grade, and 3) The exact, measurable next step to improve it.",
      },
      { kind: "h3", text: "The Written Summary (MatchMax Templates)" },
      {
        kind: "p",
        text: "Send a brief, personalized update addressed to both the parent and student. Make success criteria specific and measurable to give the student clear targets and recognize genuine effort.",
      },
      {
        kind: "templates",
        cards: [
          {
            label: "English template",
            lines: [
              "Hi [Parent] and [Student]! Here's a quick recap of today's lesson. ☺️",
              "**Covered:** We worked on [topic], focusing on [key skill].",
              "**Progress:** [Student], you were able to [specific task] independently—well done! [Skill] still needed some guidance, so we'll keep practising.",
              "**Additional practice:** Please complete [homework] by [deadline].",
              "**Next steps:** Next lesson, we'll focus on [priority]. If anything new comes up at school, please share it here beforehand so I can prepare! 🙏🏻",
            ],
          },
          {
            label: "廣東話範本",
            lines: [
              "[家長稱謂]、[同學名]，你哋好！以下係今日課堂小結。 ☺️",
              "**學習內容：**今日學咗[課題]，重點練習[技巧]。",
              "**學習進展：**[同學名]，你今日已經可以獨立完成[具體任務]，做得好！做[技巧]時暫時仲需要少少提示，我哋會繼續練習。",
              "**課後練習：**請喺[日期]前完成 [功課]。",
              "**下堂重點：**下堂暫定集中練習[重點]。如果學校有新嘅學習內容，歡迎上堂前喺群組話我知。 🙇‍♂️",
            ],
          },
        ],
      },
      { kind: "h3", text: "The Conversion: Locking in a Weekly Slot" },
      {
        kind: "p",
        text: "After the first lesson, offer a quick 15-minute call with the student to create an initial plan together using MatchMax's Study Plan sheet. Once this is done, it is your responsibility to share the Study Plan with the parent and invite them to confirm a regular slot without pressure.",
      },
      {
        kind: "scripts",
        items: [
          {
            label: "The script",
            text: "Hi [Parent], I just had a great 15-minute chat with [Student] to build out their Study Plan! I've attached it here. To keep this momentum going and ensure we hit these targets, establishing a consistent weekly routine works best. I currently have Thursdays at 17:00 available—would you like to lock this in as our regular slot? No pressure at all, just let me know what works best for your schedule! ☺️",
          },
        ],
      },
    ],
  },
  {
    id: "admin-reporting",
    shortTitle: "Admin reporting",
    title: "MatchMax Admin: reporting your hours",
    blocks: [
      {
        kind: "p",
        text: "While you manage the parent relationship, MatchMax manages the backend. To ensure billing is accurate and the Administrative Matching Fee is logged correctly, you are required to keep the MatchMax Admin updated during the crucial first two lessons.",
      },
      { kind: "h3", text: "The Pre-and-Post Lesson Reporting Protocol" },
      {
        kind: "p",
        text: "**Before Lesson 1 & Lesson 2:** The moment a parent agrees to a date and time in the group chat, message the MatchMax Admin directly to mark it on our calendar.",
      },
      {
        kind: "scripts",
        items: [
          {
            text: "Hi Admin, Lesson 1 for [Student Name] is confirmed for [Date] at [Time] for [Duration]. 🫡",
          },
        ],
      },
      {
        kind: "p",
        text: "**After Lesson 1 & Lesson 2:** Once the lesson is completed, immediately notify Admin with the finalized hours so we can accurately track the match success and log the Administrative Matching Fee.",
      },
      {
        kind: "scripts",
        items: [
          {
            text: "Hi Admin, Lesson 1 with [Student Name] completed successfully for 1.5 hours! We are scheduling Lesson 2 now. 🙏🏻",
          },
        ],
      },
      {
        kind: "p",
        text: "**Finalizing the Schedule:** Once the regular weekly slot is locked in after the first couple of lessons, inform Admin of the recurring schedule so we can finalize the file.",
      },
    ],
  },
  {
    id: "scenarios",
    shortTitle: "Survival guide",
    title: "The Scenario Survival Guide",
    blocks: [
      {
        kind: "p",
        text: "Boundary setting is vital. Stay polite to de-escalate, but stand firm.",
      },
      {
        kind: "scenarios",
        rows: [
          {
            title: "Payment dragging",
            action:
              "Assume they forgot, but escalate if ignored. Do not use corporate billing language.",
            scripts: [
              {
                label: "Script",
                text: "Hi [Parent], a gentle reminder regarding this month's lesson fees. Please let me know once settled so I can update my records! 🙏🏻",
              },
              {
                label: "Script — 48 hrs later",
                text: "Hi [Parent], following up on the pending payment. If you're having technical issues, let me know. 🫡",
              },
            ],
            escalation: "If unpaid, stop messaging and notify MatchMax Admin.",
          },
          {
            title: "Technically illiterate parent",
            action:
              "Do not just send links and expect them to figure it out. Over-communicate the tech setup.",
            scripts: [
              {
                label: "Script",
                text: "No worries at all! ☺️ I've set up one single Zoom link we will use every single time so you don't have to search for it, and I've pinned it to the top of our WhatsApp chat here. If you have 2 minutes, we can do a quick test call right now to make sure the audio works perfectly for [Student]!",
              },
            ],
          },
          {
            title: "Rude / aggressive parent",
            action:
              "Do not argue, take it personally, or promise refunds. Keep responses brief, objective, and unemotional.",
            scripts: [
              {
                label: "Script",
                text: "I hear your frustrations regarding [Issue], and I want to ensure [Student] gets the best support possible. Let's pause here so I can loop in the MatchMax team to review this and find the best way forward for everyone.",
              },
            ],
          },
          {
            title: "The “helicopter” parent (micromanaging)",
            action: "Politely establish your authority as the expert.",
            scripts: [
              {
                label: "Script",
                text: "I love how involved you are! Based on my experience with this curriculum, students thrive when given space to make mistakes during practice. I'd love to try running the next few sessions 1-on-1, and I will give you a highly detailed debrief right after. ☺️",
              },
            ],
          },
          {
            title: "Late-night texters",
            action: "Do not reply immediately if it is past 21:30. Train them on your boundaries.",
            scripts: [
              {
                label: "Script — sent the next morning",
                text: "Good morning [Parent]! Just seeing your message from last night. Regarding your question…",
              },
            ],
          },
          {
            title: "Last-minute reschedule",
            action: "Notify the group promptly and propose a solution.",
            scripts: [
              {
                label: "Script",
                text: "I completely understand things come up! 🙇‍♂️ Since this is within our 24-hour window, please note our cancellation policy. Let's find a makeup slot this week so [Student] doesn't fall behind.",
              },
            ],
          },
          {
            title: "Unresponsive parent",
            action:
              "Follow up once, then ask MatchMax for help. Do not treat an unconfirmed booking as agreed.",
            scripts: [
              {
                label: "Script",
                text: "Hi [Parent], I want to ensure I lock in [Student]'s slot. If I don't hear back by tonight, I'll need to release the time to another student. 🙏🏻",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "next-level",
    shortTitle: "Next-level service",
    title: "Next-level service: maximizing your attitude",
    blocks: [
      {
        kind: "p",
        text: "To transform from a “good tutor” to an “irreplaceable MatchMax elite tutor,” deploy these proactive strategies:",
      },
      {
        kind: "ul",
        items: [
          "**The \"Exam Season\" Care Package:** Don't wait for the parent to panic. 6 weeks before midterms, proactively send a structured revision timeline. “Hi [Parent], mocks are approaching. I've mapped out a 6-week revision schedule for [Student] so we are fully prepared! 🫡”",
          "**Strategic Voice Notes:** Instead of typing out a long, dry explanation to a parent's complex question about university requirements or syllabus changes, send a confident 30-second voice note. Hearing your articulate, professional voice actively explaining a concept builds immense trust.",
          "**Extracurricular Rapport:** Take notes on the student's life. If they have a basketball tournament, ask how it went at the start of the next lesson (and mention it to the parents). Parents notice when you treat their child as a whole person, not just an hourly fee.",
          "**The Progress Audit:** Every 4–6 weeks, or sooner if needs change, review and update the Study Plan with the student and share key updates with parents without them having to ask. Explain any gaps honestly and agree on realistic priorities and revised strategies.",
        ],
      },
    ],
  },
];

const SECTION_NUMBERS = SECTIONS.map((section, index) => String(index + 1).padStart(2, "0"));

const SECTION_IDS = SECTIONS.map((section) => section.id);

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={index} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

function ScriptCard({ label, text }: ScriptCardData) {
  return (
    <figure className="rounded-xl border border-border bg-muted/50 p-4 sm:p-5">
      {label ? (
        <figcaption className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--brand-link)]">
          {label}
        </figcaption>
      ) : null}
      <blockquote className={`text-sm italic leading-7 text-foreground/85 ${label ? "mt-2" : ""}`}>
        “{text}”
      </blockquote>
    </figure>
  );
}

function SayBlock({ dont, do: doText }: { dont: string; do: string }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border p-4 sm:p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Don't say
        </p>
        <p className="mt-2 text-sm italic leading-7 text-muted-foreground">“{dont}”</p>
      </div>
      <div className="rounded-xl border border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/5 p-4 sm:p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--brand-link)]">
          Do say
        </p>
        <p className="mt-2 text-sm italic leading-7 text-foreground/85">{renderInline(doText)}</p>
      </div>
    </div>
  );
}

function TemplateCards({ cards }: { cards: [TemplateCardData, TemplateCardData] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-bold text-foreground">{card.label}</p>
          <div className="mt-3 space-y-3">
            {card.lines.map((line, index) => (
              <p key={index} className="text-sm leading-7 text-foreground/80">
                {renderInline(line)}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScenarioRows({ rows }: { rows: Scenario[] }) {
  return (
    <div className="rounded-2xl border border-border px-5 py-2 sm:px-8 sm:py-3">
      {rows.map((row, index) => {
        const isLast = index === rows.length - 1;
        return (
          <div key={row.title} className={`py-6 ${isLast ? "" : "border-b border-border"}`}>
            <h4 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
              {row.title}
            </h4>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {renderInline(`**Action:** ${row.action}`)}
            </p>
            <div className="mt-3 space-y-3">
              {row.scripts.map((script) => (
                <ScriptCard key={script.text} {...script} />
              ))}
            </div>
            {row.escalation ? (
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {renderInline(`**Escalation:** ${row.escalation}`)}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function SectionBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case "h3":
            return (
              <h3
                key={index}
                className="pt-5 text-xl font-bold tracking-tight text-foreground sm:text-2xl"
              >
                {block.text}
              </h3>
            );
          case "ul":
            return (
              <ul
                key={index}
                className="list-disc space-y-3 pl-5 marker:text-[color:var(--brand-link)]"
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="pl-1 text-base leading-7 text-muted-foreground">
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            );
          case "scripts":
            return (
              <div key={index} className="space-y-3">
                {block.items.map((script) => (
                  <ScriptCard key={script.text} {...script} />
                ))}
              </div>
            );
          case "say":
            return <SayBlock key={index} dont={block.dont} do={block.do} />;
          case "templates":
            return <TemplateCards key={index} cards={block.cards} />;
          case "scenarios":
            return <ScenarioRows key={index} rows={block.rows} />;
          case "note":
            return (
              <aside
                key={index}
                className="border-l-2 border-border pl-4 text-sm italic leading-7 text-muted-foreground"
              >
                {block.text}
              </aside>
            );
          default:
            return (
              <p key={index} className="text-base leading-7 text-muted-foreground sm:text-[17px]">
                {renderInline(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
}

const EXPLORE_CARDS = [
  {
    to: "/how-it-works",
    icon: BookOpen,
    title: "How it works",
    subtitle: "Matching, fees, and the concierge window.",
  },
  {
    to: "/tutor-requests",
    icon: Briefcase,
    title: "Browse open cases",
    subtitle: "Find your next matched student.",
  },
  {
    to: "/join",
    icon: UserRoundCheck,
    title: "Apply as a tutor",
    subtitle: "Get verified and start receiving leads.",
  },
] as const;

function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string>(ids[0] ?? "");

  useEffect(() => {
    // Active = last section whose top has crossed the 25%-of-viewport line.
    // A passive scroll listener is used instead of IntersectionObserver, which
    // is unreliable in some embedded webviews after programmatic scrolls.
    const computeActive = () => {
      const bandY = window.scrollY + window.innerHeight * 0.25;
      let current = ids[0] ?? "";
      for (const id of ids) {
        const element = document.getElementById(id);
        if (!element) continue;
        if (element.getBoundingClientRect().top + window.scrollY <= bandY) current = id;
      }
      setActive(current);
    };
    computeActive();
    window.addEventListener("scroll", computeActive, { passive: true });
    window.addEventListener("resize", computeActive);
    return () => {
      window.removeEventListener("scroll", computeActive);
      window.removeEventListener("resize", computeActive);
    };
  }, [ids]);

  return active;
}

function TutorPlaybookPage() {
  const activeSection = useActiveSection(SECTION_IDS);
  const activeChipRef = useRef<HTMLAnchorElement | null>(null);

  // Keep the active chip visible in the horizontal scroller (sections 04–06
  // start off-screen to the right on mobile).
  useEffect(() => {
    activeChipRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "instant",
    });
  }, [activeSection]);

  return (
    <PublicPage>
      <div className="mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6 lg:hidden">
        <PageBackButton fallbackTo="/how-it-works" />
      </div>

      <PageIntro
        eyebrow="Help Centre · For Tutors"
        title="The MatchMax Tutor Playbook"
        description="Real-world scripts and protocols for managing parent expectations, handling logistics, communicating value, and coordinating with MatchMax Admin."
        meta="Parent relations & etiquette · For MatchMax tutors"
      />

      {/* Mobile section tabs — Airbnb persona-tab style, sticky under the mobile top bar */}
      <nav
        aria-label="Playbook sections"
        className="sticky top-14 z-30 border-b border-border bg-background/95 backdrop-blur-sm lg:hidden"
      >
        <div className="relative">
          <div className="flex gap-6 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                ref={activeSection === section.id ? activeChipRef : undefined}
                href={`#${section.id}`}
                className={`-mb-px whitespace-nowrap border-b-[3px] py-3 text-[15px] transition-colors ${
                  activeSection === section.id
                    ? "border-foreground font-semibold text-foreground"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                {section.shortTitle}
              </a>
            ))}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 flex items-center bg-gradient-to-l from-background to-transparent pl-8 pr-1.5"
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </nav>

      <section className="py-14 sm:py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
          <nav aria-label="Playbook sections" className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                In this playbook
              </p>
              <ul className="mt-4 space-y-1">
                {SECTIONS.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className={`-ml-4 block border-l-2 py-2 pl-4 text-sm leading-6 transition-colors ${
                        activeSection === section.id
                          ? "border-[color:var(--brand-link)] font-semibold text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span className="mr-2 font-bold text-[color:var(--brand-link)]">
                        {SECTION_NUMBERS[index]}
                      </span>
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="min-w-0">
            <Button asChild size="lg" variant="solid" color="accent" className="w-full sm:w-auto">
              <Link to="/tutor-requests">
                Browse open cases <ArrowRight />
              </Link>
            </Button>

            <div className="mt-8 space-y-5">
              <p className="text-base leading-7 text-muted-foreground sm:text-[17px]">
                Parents booking through MatchMax aren't just looking for someone who knows the
                syllabus; they are paying for peace of mind, reliability, and an elite service
                experience. Every tutor represents MatchMax and shapes our reputation, so your
                success is our success—and our success is yours. This handbook gives you the exact
                scripts, psychology, and boundaries you need to look like a seasoned professional
                from day one.
              </p>
              <aside className="border-l-2 border-border pl-4 text-sm italic leading-7 text-muted-foreground">
                Note: Classroom management and teaching techniques are covered in the separate
                MatchMax Tutor Lesson Quality Guide. This guide focuses strictly on mastering parent
                relations, etiquette, and essential admin.
              </aside>
            </div>

            {SECTIONS.map((section, index) => (
              <article
                key={section.id}
                id={section.id}
                className="scroll-mt-32 border-b border-border py-12 first-of-type:mt-12 lg:py-16"
              >
                <div className="flex items-baseline gap-4">
                  <span className="text-sm font-bold text-[color:var(--brand-link)]">
                    {SECTION_NUMBERS[index]}
                  </span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                    {section.title}
                  </h2>
                </div>
                <div className="mt-6">
                  <SectionBlocks blocks={section.blocks} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0f1419] text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Explore more
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {EXPLORE_CARDS.map((card) => (
              <Link
                key={card.to}
                to={card.to}
                className="group flex overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] transition-colors hover:bg-white/10"
              >
                <div className="flex w-20 shrink-0 items-center justify-center self-stretch bg-white sm:w-24">
                  <card.icon className="h-8 w-8 text-[#0f1419]" aria-hidden="true" />
                </div>
                <div className="flex flex-1 flex-col justify-center p-5">
                  <p className="text-lg font-bold text-white">{card.title}</p>
                  <p className="mt-1 text-sm leading-6 text-white/70">{card.subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}
