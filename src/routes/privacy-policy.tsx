import { createFileRoute } from "@tanstack/react-router";
import { Info, MessageSquareText, Shield, Siren } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | MatchMax" },
      {
        name: "description",
        content: "Privacy policy and trust-and-safety principles for using MatchMax.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: PrivacyPolicyPage,
});

const SECTIONS = [
  {
    icon: Shield,
    title: "Verified Tutor Profiles",
    intro:
      "Every tutor on our platform goes through a verification process to ensure quality and reliability. We collect and verify:",
    points: [
      "Identity verification",
      "Educational qualifications and credentials",
      "Teaching experience and background",
      "References and reviews from previous students",
    ],
    closing:
      "This helps parents make informed decisions and protects both students and tutors from fraud or misrepresentation.",
  },
  {
    icon: MessageSquareText,
    title: "Pre-Booking Chat & Contact Details",
    intro:
      "Parents and tutors can chat before booking to discuss details, ask questions, and ensure compatibility.",
    points: [
      "Contact details may be partially hidden until a booking is confirmed",
      "This helps reduce the risk of scams or fraudulent contact",
      "It also prevents tutors from being contacted outside the platform to avoid commission issues",
    ],
    closing: "Once a lesson is booked and confirmed, full contact details are shared for lesson coordination.",
  },
  {
    icon: Siren,
    title: "Reporting & Moderation",
    intro:
      "If you encounter suspicious behavior, fraud, or safety concerns, please report it immediately:",
    points: [
      "Use the report button on any profile or message",
      "Contact our support team directly with details",
      "We investigate all reports thoroughly and take appropriate action",
      "Serious violations may result in account suspension or permanent removal",
    ],
    closing:
      "Our moderation team works 24/7 to ensure the platform remains safe and trustworthy for all users.",
  },
];

function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <SiteHeader />
      <main className="flex-1 pb-16">
        <section className="border-b border-border bg-[#041344] py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#77E8EE]">Trust &amp; Safety</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">Ask us anything</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#D7F8FA]">
              We&apos;re committed to creating a safe, transparent, and trustworthy marketplace for both parents
              and tutors.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 pt-12 sm:px-6">
          <div className="space-y-8">
            {SECTIONS.map((section) => (
              <article
                key={section.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
              >
                <div className="flex flex-col items-start gap-6 sm:flex-row">
                  <div className="rounded-xl bg-[#77E8EE]/20 p-4 text-[#0A245F]">
                    <section.icon className="h-7 w-7" strokeWidth={2.5} />
                  </div>

                  <div className="flex-1 space-y-4">
                    <h2 className="text-2xl font-black text-[#041344]">{section.title}</h2>
                    <p className="text-sm leading-relaxed text-slate-600">{section.intro}</p>
                    <ul className="space-y-2 pl-6 text-slate-600 marker:text-[#2ED5DE]">
                      {section.points.map((point) => (
                        <li key={point} className="list-disc pl-1">
                          {point}
                        </li>
                      ))}
                    </ul>
                    <p className="text-sm leading-relaxed text-slate-600">{section.closing}</p>
                  </div>
                </div>
              </article>
            ))}

            <article className="rounded-2xl border border-[#D1F0F2] bg-[#EAFBFC] p-6 shadow-sm sm:p-8">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-white p-4 text-[#0A245F]">
                  <Info className="h-7 w-7" strokeWidth={2.5} />
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-black text-[#041344]">Have Safety Concerns?</h2>
                  <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
                    Our support team is here to help. If you have any questions about safety, encounter suspicious
                    activity, or need assistance, please don&apos;t hesitate to reach out.
                  </p>
                  <a
                    href="/faq"
                    className="inline-flex h-10 items-center justify-center rounded-md bg-[color:var(--brand-navy)] px-4 text-sm font-medium text-white transition-colors hover:bg-[color:var(--brand-royal)]"
                  >
                    Contact Support
                  </a>
                </div>
              </div>
            </article>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
