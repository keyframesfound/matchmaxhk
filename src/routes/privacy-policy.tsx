import { createFileRoute } from "@tanstack/react-router";
import { Shield, MessageSquareText, Siren } from "lucide-react";
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
    points: [
      "Identity verification checks.",
      "Credential and educational background review.",
      "Profile checks for quality and reliability.",
      "Ongoing moderation based on platform reports.",
    ],
  },
  {
    icon: MessageSquareText,
    title: "Pre-Booking Chat & Contact Details",
    points: [
      "Parents and tutors can discuss details before booking.",
      "Certain contact details may be partially hidden before confirmation.",
      "This reduces scam risk and keeps communication safe.",
      "Confirmed lessons can proceed with proper coordination details.",
    ],
  },
  {
    icon: Siren,
    title: "Reporting & Moderation",
    points: [
      "Users can report suspicious behavior or safety concerns.",
      "Our team reviews reports and takes action where needed.",
      "Serious violations may lead to suspension or account removal.",
      "We work to keep the platform safe for families and tutors.",
    ],
  },
];

function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-black">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border py-14 sm:py-18">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <h1 className="text-4xl font-black tracking-tight text-black sm:text-5xl">Privacy Policy</h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-black">
              We are committed to a safe, transparent, and trustworthy experience for both parents and tutors.
            </p>
          </div>
        </section>

        <section className="py-10 sm:py-14">
          <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6">
            {SECTIONS.map((section) => (
              <article key={section.title} className="rounded-2xl border border-border bg-white p-6">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-slate-100 p-2 text-[color:var(--brand-navy)]">
                    <section.icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-2xl font-black text-black">{section.title}</h2>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-black">
                      {section.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
