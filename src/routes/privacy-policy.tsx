import { createFileRoute } from "@tanstack/react-router";
import { Shield, MessageSquareText, Siren, UserCog, FileText, Lock } from "lucide-react";
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

export const INTRO_TEXT = "At MatchMax, ('MatchMax', 'we' or 'us'), we respect your legal rights to privacy when collecting, storing, using and transmitting personal data. This statement explains our personal data practices in compliance with the requirements of the Personal Data (Privacy) Ordinance (Cap. 486) of the Laws of the Hong Kong Special Administrative Region.";

const SECTIONS = [
  {
    icon: FileText,
    title: "Purpose of Collection",
    description: "We will only use personal data collected from you for one or more of the following purposes:",
    points: [
      "To establish and maintain a record of your involvement in any MatchMax activities;",
      "To provide services you have requested from us;",
      "To answer your inquiry;",
      "To keep you informed of new developments or programmes we believe may be of interest to you."
    ],
    footer: "We will not use or disclose your personal data for any other purpose without first seeking your written consent, unless authorised or required by law. We will not publish or make known publicly to others any and all personal data provided to us such as health information, Hong Kong ID card, address or contact details in newsletters, email or phone inquiries, or bulletins without the written consent by you."
  },
  {
    icon: Lock,
    title: "Data Security",
    description: "We will take reasonable measures to keep secure the personal data which we hold and to protect it from any and all unauthorised disclosure and misuse.",
    points: []
  },
  {
    icon: UserCog,
    title: "Access to Personal Data",
    description: "You have the right to opt out of any communication from us. We will only maintain your personal data if legally permitted to do so, after you have instructed us not to send information and communications to you. You have the right to request access to and correction of your personal data as provided in the Personal Data (Privacy) Ordinance. Your right of access includes the right to obtain a copy of your personal data and the right to correct any of the data that is inaccurate.",
    footer: "Requests for access to and/or correction of your personal data relating to your application should be sent to:\n\nExecutive Director\nMatchMax",
    points: []
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
