import React from 'react';
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About | MatchMax" },
      {
        name: "description",
        content: "Learn how MatchMax works for tutors, from application and verification to student requests.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: AboutPage,
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
  { title: "Steady Student Flow", text: "We focus on marketing and matching so you receive relevant requests." },
  { title: "Grow Your Income", text: "Set your own rate and increase as your profile and results grow." },
  { title: "Professional Platform", text: "Build trust with a verified profile and consistent case management." },
  { title: "Flexible & Independent", text: "Control your availability, schedule, and lesson mode preferences." },
];

function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-black">
      <SiteHeader />
      <main className="flex-1">
        
        {/* --- ORIGINAL HERO SECTION --- */}
        <section className="border-b border-border py-14 sm:py-18">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h1 className="text-4xl font-black tracking-tight text-black sm:text-5xl">How It Works for Tutors</h1>
            <p className="mt-4 max-w-2xl text-base text-black">
              Join our community of verified tutors and grow your tutoring business with a steady stream of qualified students.
            </p>
          </div>
        </section>

        {/* --- ORIGINAL STEPS & BENEFITS SECTION --- */}
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
                      <h2 className="text-2xl font-black text-black">{step.title}</h2>
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

            <h3 className="mt-12 text-center text-3xl font-black tracking-tight text-black">Why Join Us?</h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {BENEFITS.map((item) => (
                <article key={item.title} className="rounded-xl border border-border bg-white p-5">
                  <h4 className="text-lg font-extrabold text-black">{item.title}</h4>
                  <p className="mt-2 text-sm text-black">{item.text}</p>
                </article>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button asChild className="font-bold">
                <Link to="/become-a-tutor">
                  Apply as a Tutor <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="font-bold">
                <Link to="/tutors">Browse Tutors</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* --- NEW ABOUT MATCHMAX SECTION --- */}
        <section className="flex justify-center bg-white border-t border-border">
          <div
            style={{
              width: '100%',
              maxWidth: 1280,
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              display: 'flex',
            }}
          >
            {/* Header Block */}
            <div
              style={{
                alignSelf: 'stretch',
                paddingLeft: 240,
                paddingRight: 240,
                paddingTop: 80,
                paddingBottom: 80,
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 32,
                display: 'flex',
              }}
            >
              <div
                style={{
                  textAlign: 'center',
                  justifyContent: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  color: 'rgba(0, 0, 0, 0.55)',
                  fontSize: 18,
                  fontFamily: 'Inter',
                  fontWeight: 500,
                  lineHeight: '26.10px',
                  wordWrap: 'break-word',
                }}
              >
                {`Aug 2, 2026`}
              </div>
              <div
                style={{
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: 16,
                  display: 'flex',
                }}
              >
                <div
                  style={{
                    width: 800,
                    textAlign: 'center',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'var(--Deep-Navy, #041344)',
                    fontSize: 64,
                    fontFamily: 'Inter',
                    fontWeight: 700,
                    lineHeight: '70.40px',
                    wordWrap: 'break-word',
                  }}
                >
                  {`About`}
                </div>
                <div
                  style={{
                    textAlign: 'center',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'rgba(0, 0, 0, 0.55)',
                    fontSize: 18,
                    fontFamily: 'Inter',
                    fontWeight: 500,
                    lineHeight: '26.10px',
                    wordWrap: 'break-word',
                  }}
                >
                  {`Founder of MatchMax`}
                </div>
              </div>
            </div>

            {/* Illustration Block */}
            <div
              style={{
                alignSelf: 'stretch',
                paddingBottom: 40,
                paddingLeft: 240,
                paddingRight: 240,
                justifyContent: 'center',
                alignItems: 'flex-start',
                display: 'inline-flex',
              }}
            >
              <img
                style={{ flex: '1 1 0', height: 533.33, borderRadius: 16, objectFit: 'cover' }}
                src="https://matchmax.hk/auth-illustration.png"
                alt="About MatchMax Placeholder"
              />
            </div>

            {/* Mission & How it Works Block */}
            <div
              style={{
                alignSelf: 'stretch',
                paddingLeft: 240,
                paddingRight: 240,
                paddingTop: 80,
                paddingBottom: 80,
                justifyContent: 'center',
                alignItems: 'flex-start',
                display: 'inline-flex',
              }}
            >
              <div
                style={{
                  flex: '1 1 0',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  gap: 48,
                  display: 'inline-flex',
                }}
              >
                <div
                  style={{
                    alignSelf: 'stretch',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: 16,
                    display: 'flex',
                  }}
                >
                  <div
                    style={{
                      alignSelf: 'stretch',
                      justifyContent: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      color: 'var(--Deep-Navy, #041344)',
                      fontSize: 24,
                      fontFamily: 'Inter',
                      fontWeight: 600,
                      lineHeight: '28.80px',
                      wordWrap: 'break-word',
                    }}
                  >
                    {`Our mission`}
                  </div>
                  <div
                    style={{
                      alignSelf: 'stretch',
                      justifyContent: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      color: 'black',
                      fontSize: 18,
                      fontFamily: 'Inter',
                      fontWeight: 500,
                      lineHeight: '26.10px',
                      wordWrap: 'break-word',
                    }}
                  >
                    {`We started off as a bunch of high school seniors helping freshmen transition into high school. As goofy as we were, we eventually came to realize how valuable this help is and can be! Now, we've evolved into an educational institute on a mission to help students navigate their academic journeys from crushing their courses to applying to their dream universities.`}
                  </div>
                </div>
                
                <div
                  style={{
                    alignSelf: 'stretch',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: 16,
                    display: 'flex',
                  }}
                >
                  <div
                    style={{
                      alignSelf: 'stretch',
                      justifyContent: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      color: 'var(--Deep-Navy, #041344)',
                      fontSize: 24,
                      fontFamily: 'Inter',
                      fontWeight: 600,
                      lineHeight: '28.80px',
                      wordWrap: 'break-word',
                    }}
                  >
                    {`How this works`}
                  </div>
                  <div
                    style={{
                      alignSelf: 'stretch',
                      justifyContent: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <span
                      style={{
                        color: 'black',
                        fontSize: 18,
                        fontFamily: 'Inter',
                        fontWeight: 500,
                        lineHeight: '26.10px',
                        wordWrap: 'break-word',
                      }}
                    >
                      {`We match you with experienced top scorers in these programs and fields, where you can learn to excel just like them, via tailored 1 on 1 tutoring. These tutors are not just tutors, they will be your `}
                    </span>
                    <span
                      style={{
                        color: 'var(--Royal-Navy, #0A245F)',
                        fontSize: 18,
                        fontFamily: 'Inter',
                        fontWeight: 700,
                        lineHeight: '26.10px',
                        wordWrap: 'break-word',
                      }}
                    >
                      {`friend`}
                    </span>
                    <span
                      style={{
                        color: 'black',
                        fontSize: 18,
                        fontFamily: 'Inter',
                        fontWeight: 500,
                        lineHeight: '26.10px',
                        wordWrap: 'break-word',
                      }}
                    >
                      {`, `}
                    </span>
                    <span
                      style={{
                        color: 'var(--Royal-Navy, #0A245F)',
                        fontSize: 18,
                        fontFamily: 'Inter',
                        fontWeight: 700,
                        lineHeight: '26.10px',
                        wordWrap: 'break-word',
                      }}
                    >
                      {`mentor`}
                    </span>
                    <span
                      style={{
                        color: 'black',
                        fontSize: 18,
                        fontFamily: 'Inter',
                        fontWeight: 500,
                        lineHeight: '26.10px',
                        wordWrap: 'break-word',
                      }}
                    >
                      {`, your point of contact when you're stuck with anything school(or life!) related, and someone you can look up to..`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quote Block */}
            <div
              style={{
                alignSelf: 'stretch',
                paddingLeft: 240,
                paddingRight: 240,
                paddingTop: 80,
                paddingBottom: 80,
                overflow: 'hidden',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 48,
                display: 'flex',
              }}
            >
              <div
                style={{
                  alignSelf: 'stretch',
                  textAlign: 'center',
                  justifyContent: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  color: 'var(--Royal-Navy, #0A245F)',
                  fontSize: 48,
                  fontFamily: 'Inter',
                  fontWeight: 700,
                  lineHeight: '62.40px',
                  wordWrap: 'break-word',
                }}
              >
                {`"We are a bunch of students working for students"`}
              </div>
              <div
                style={{
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: 16,
                  display: 'inline-flex',
                }}
              >
                <img
                  style={{ width: 64, height: 64, borderRadius: 8 }}
                  src="https://matchmax.hk/apple-touch-icon.png"
                  alt="Founder Avatar"
                />
                <div
                  style={{
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: 4,
                    display: 'inline-flex',
                  }}
                >
                  <div
                    style={{
                      color: 'black',
                      fontSize: 24,
                      fontFamily: 'Inter',
                      fontWeight: 600,
                      lineHeight: '33.60px',
                      wordWrap: 'break-word',
                    }}
                  >
                    {`Full name`}
                  </div>
                  <div
                    style={{
                      justifyContent: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      color: 'rgba(0, 0, 0, 0.55)',
                      fontSize: 18,
                      fontFamily: 'Inter',
                      fontWeight: 500,
                      lineHeight: '26.10px',
                      wordWrap: 'break-word',
                    }}
                  >
                    {`Founder of MatchMax`}
                  </div>
                </div>
              </div>
            </div>

            {/* Final Network Block */}
            <div
              style={{
                alignSelf: 'stretch',
                paddingTop: 80,
                paddingBottom: 120,
                paddingLeft: 240,
                paddingRight: 240,
                justifyContent: 'center',
                alignItems: 'flex-start',
                display: 'inline-flex',
              }}
            >
              <div
                style={{
                  flex: '1 1 0',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  gap: 16,
                  display: 'inline-flex',
                }}
              >
                <div
                  style={{
                    alignSelf: 'stretch',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'var(--Deep-Navy, #041344)',
                    fontSize: 24,
                    fontFamily: 'Inter',
                    fontWeight: 600,
                    lineHeight: '28.80px',
                    wordWrap: 'break-word',
                  }}
                >
                  {`Join Our MatchMax Network`}
                </div>
                <div
                  style={{
                    alignSelf: 'stretch',
                    justifyContent: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'black',
                    fontSize: 18,
                    fontFamily: 'Inter',
                    fontWeight: 500,
                    lineHeight: '26.10px',
                    wordWrap: 'break-word',
                  }}
                >
                  {`MatchMax is Hong Kong's fast-growing academic matching platform, built to help tutors grow their teaching careers without the hassle of finding students. We take care of marketing, client acquisition, and student matching, allowing you to focus on what you do best—teaching. Every tutor also receives free personal branding through a professionally designed profile featured on our website and Instagram, helping you stand out to prospective families. With an average matching turnaround of around 1.5 weeks and a transparent commission structure that applies only to the 1st and 11th lesson of each student contract, you keep 100% of your earnings from every other lesson. It's a simpler, fairer way to build your tutoring business.`}
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </div>
  );
}