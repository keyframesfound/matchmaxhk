import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Search, UserPlus } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { BlurHighlightText } from "@/components/ui/blur-highlight-text";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works | MatchMax" },
      {
        name: "description",
        content:
          "Learn how MatchMax works for tutors, from application and verification to student requests.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: HowItWorksPage,
});

const STEPS = [
  {
    title: "Apply to Join",
    points: [
      "Submit your profile with subjects, levels, and rates.",
      "Share your teaching background and availability.",
      "Tell us your tutoring goals and strengths.",
    ],
  },
  {
    title: "Get Verified",
    points: [
      "Identity verification.",
      "Qualification and credential checks.",
      "Profile quality review and approval.",
    ],
  },
  {
    title: "Receive Student Requests",
    points: [
      "Get qualified parent requests in your subjects.",
      "Review student details, budgets, and scheduling.",
      "Accept suitable cases and start teaching.",
    ],
  },
];

const BENEFITS = [
  {
    title: "Steady Student Flow",
    text: "We focus on marketing and matching so you receive relevant requests.",
  },
  {
    title: "Grow Your Income",
    text: "Set your own rate and increase as your profile and results grow.",
  },
  {
    title: "Professional Platform",
    text: "Build trust with a verified profile and consistent case management.",
  },
  {
    title: "Flexible & Independent",
    text: "Control your availability, schedule, and lesson mode preferences.",
  },
];

function HowItWorksPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-black">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border py-14 sm:py-18">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h1 className="text-4xl font-black tracking-tight text-black sm:text-5xl">
              <BlurHighlightText highlights={["How It Works", "Tutors"]}>
                How It Works for Tutors
              </BlurHighlightText>
            </h1>
            <p className="mt-4 max-w-2xl text-base text-black">
              <BlurHighlightText highlights={["verified tutors", "qualified students"]}>
                Join our community of verified tutors and grow your tutoring business with a steady
                stream of qualified students.
              </BlurHighlightText>
            </p>
          </div>
        </section>

        <section className="py-10 sm:py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="space-y-8">
              {STEPS.map((step, index) => (
                <article key={step.title} className="rounded-2xl border border-border bg-white p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-navy)] text-sm font-bold text-white">
                      {index + 1}
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-black text-black">
                        <BlurHighlightText
                          highlights={
                            step.title === "Get Verified"
                              ? ["Verified"]
                              : step.title === "Receive Student Requests"
                                ? ["Student Requests"]
                                : ["Join"]
                          }
                        >
                          {step.title}
                        </BlurHighlightText>
                      </h2>
                      <ul className="space-y-1.5 text-sm text-black">
                        {step.points.map((point) => (
                          <li key={point} className="flex items-start gap-2">
                            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-teal)]" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <h3 className="mt-12 text-center text-3xl font-black tracking-tight text-black">
              <BlurHighlightText highlights={["Join"]}>Why Join Us?</BlurHighlightText>
            </h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {BENEFITS.map((item) => (
                <article key={item.title} className="rounded-xl border border-border bg-white p-5">
                  <h4 className="text-lg font-extrabold text-black">{item.title}</h4>
                  <p className="mt-2 text-sm text-black">{item.text}</p>
                </article>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button
                asChild
                className="bg-[color:var(--brand-navy)] font-bold text-white shadow-brand transition-colors hover:bg-[color:var(--brand-teal)]/18 hover:text-[color:var(--brand-navy)]"
              >
                <Link to="/join">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Apply as a Tutor <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="font-bold">
                <Link to="/tutors">
                  <Search className="mr-2 h-4 w-4" />
                  Browse Tutors
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
