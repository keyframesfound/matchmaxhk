import { createFileRoute } from "@tanstack/react-router";
import { Info, UserCog, FileText, Lock } from "lucide-react";
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

export const INTRO_TEXT =
  "At MatchMax, ('MatchMax', 'we' or 'us'), we respect your legal rights to privacy when collecting, storing, using and transmitting personal data. This statement explains our personal data practices in compliance with the requirements of the Personal Data (Privacy) Ordinance (Cap. 486) of the Laws of the Hong Kong Special Administrative Region.";

const SECTIONS = [
  {
    icon: FileText,
    title: "Purpose of Collection",
    intro:
      "We will only use personal data collected from you for one or more of the following purposes:",
    points: [
      "To establish and maintain a record of your involvement in any MatchMax activities;",
      "To provide services you have requested from us;",
      "To answer your inquiry;",
      "To keep you informed of new developments or programmes we believe may be of interest to you.",
    ],
    closing:
      "We will not use or disclose your personal data for any other purpose without first seeking your written consent, unless authorised or required by law. We will not publish or make known publicly to others any and all personal data provided to us such as health information, Hong Kong ID card, address or contact details in newsletters, email or phone inquiries, or bulletins without the written consent by you.",
  },
  {
    icon: Lock,
    title: "Data Security",
    intro:
      "We will take reasonable measures to keep secure the personal data which we hold and to protect it from any and all unauthorised disclosure and misuse.",
    points: [],
    closing: "",
  },
  {
    icon: UserCog,
    title: "Access to Personal Data",
    intro:
      "You have the right to opt out of any communication from us. We will only maintain your personal data if legally permitted to do so, after you have instructed us not to send information and communications to you. You have the right to request access to and correction of your personal data as provided in the Personal Data (Privacy) Ordinance. Your right of access includes the right to obtain a copy of your personal data and the right to correct any of the data that is inaccurate.",
    points: [],
    closing:
      "Requests for access to and/or correction of your personal data relating to your application should be sent to: info@matchmax.hk\n\nExecutive Director\nMatchMax",
  },
];

function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--surface)] text-[color:var(--ink)]">
      <SiteHeader />
      <main className="flex-1 pb-16">
        <section className="border-b border-border bg-[color:var(--surface)] py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h1 className="mt-3 text-4xl font-black tracking-tight text-[color:var(--ink)] sm:text-5xl">
              Privacy Policy
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[color:var(--ink)]/70">
              We&apos;re committed to creating a safe, transparent, and trustworthy marketplace for both parents
              and tutors.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 pt-12 sm:px-6">
          <div className="space-y-8">
            
            {/* Intro Content Box */}
            <article className="rounded-2xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-6 shadow-sm sm:p-8">
              <p className="text-sm leading-relaxed text-[color:var(--ink)]/70 sm:text-base">
                {INTRO_TEXT}
              </p>
            </article>

            {/* Policy Sections */}
            {SECTIONS.map((section) => (
              <article
                key={section.title}
                className="rounded-2xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
              >
                <div className="flex flex-col items-start gap-6 sm:flex-row">
                  <div className="rounded-xl bg-[color:var(--ink)]/10 p-4 text-[color:var(--ink)]">
                    <section.icon className="h-7 w-7" strokeWidth={2.5} />
                  </div>

                  <div className="flex-1 space-y-4">
                    <h2 className="text-2xl font-black text-[color:var(--ink)]">{section.title}</h2>
                    
                    {section.intro && (
                      <p className="text-sm leading-relaxed text-[color:var(--ink)]/70">{section.intro}</p>
                    )}
                    
                    {section.points && section.points.length > 0 && (
                      <ul className="space-y-2 pl-6 text-sm text-[color:var(--ink)]/70 marker:text-[color:var(--ink)]">
                        {section.points.map((point) => (
                          <li key={point} className="list-disc pl-1">
                            {point}
                          </li>
                        ))}
                      </ul>
                    )}
                    
                    {section.closing && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--ink)]/70">
                        {section.closing}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}

            {/* Support / Contact Block */}
            <article className="rounded-2xl border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-6 shadow-sm sm:p-8">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-[color:var(--ink)]/10 p-4 text-[color:var(--ink)]">
                  <Info className="h-7 w-7" strokeWidth={2.5} />
                </div>
                <div className="space-y-3">
                  <h2 className="text-2xl font-black text-[color:var(--ink)]">Privacy Questions?</h2>
                  <p className="max-w-2xl text-sm leading-relaxed text-[color:var(--ink)]/70">
                    Our support team is here to help. If you have any questions about how we handle your data, 
                    or need to submit a data request, please don&apos;t hesitate to reach out.
                  </p>
                  <a
                    href="/faq"
                    className="inline-flex h-10 items-center justify-center rounded-md bg-[color:var(--surface-invert)] px-4 text-sm font-medium text-white transition-colors hover:bg-[color:var(--surface-invert-hover)]"
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