import { createFileRoute } from "@tanstack/react-router";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicPage } from "@/components/layout/PublicPage";

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
    title: "Data Security",
    intro:
      "We will take reasonable measures to keep secure the personal data which we hold and to protect it from any and all unauthorised disclosure and misuse.",
    points: [],
    closing: "",
  },
  {
    title: "Access to Personal Data",
    intro:
      "You have the right to opt out of any communication from us. We will only maintain your personal data if legally permitted to do so, after you have instructed us not to send information and communications to you. You have the right to request access to and correction of your personal data as provided in the Personal Data (Privacy) Ordinance. Your right of access includes the right to obtain a copy of your personal data and the right to correct any of the data that is inaccurate.",
    points: [],
    closing:
      "Requests for access to and/or correction of your personal data relating to your application should be sent to: contact@matchmax.hk\n\nExecutive Director\nMatchMax",
  },
];

function PrivacyPolicyPage() {
  return (
    <PublicPage>
      <PageIntro
        description="Your privacy matters to us. This policy explains how MatchMax collects and handles your personal data."
        eyebrow="Legal"
        meta="Current as of 3 September 2026"
        title="Privacy Policy"
      />

      <section className="py-14 sm:py-20">
        <PageContainer width="narrow">
          <div className="space-y-12">
          <div className="border-b border-border pb-12 text-base leading-7 text-muted-foreground">
            <p>{INTRO_TEXT}</p>
          </div>

          {SECTIONS.map((section) => (
            <article key={section.title} className="border-b border-border pb-12 last:border-b-0 last:pb-0">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{section.title}</h2>
              <div className="mt-5 space-y-5 text-base leading-7 text-muted-foreground">
                {section.intro && <p>{section.intro}</p>}
                {section.points.length > 0 && (
                  <ul className="list-disc space-y-3 pl-5 marker:text-[color:var(--brand-link)]">
                    {section.points.map((point) => (
                      <li key={point} className="pl-1">
                        {point}
                      </li>
                    ))}
                  </ul>
                )}
                {section.closing && <p className="whitespace-pre-wrap">{section.closing}</p>}
              </div>
            </article>
          ))}

            <article className="border-t border-border pt-12">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Questions About Privacy?</h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
                For questions about how we handle your data, or to submit a data access or correction request, contact us at{" "}
                <a className="font-semibold text-[color:var(--brand-link)] underline underline-offset-4" href="mailto:contact@matchmax.hk">
                  contact@matchmax.hk
                </a>
                .
              </p>
            </article>
          </div>
        </PageContainer>
      </section>
    </PublicPage>
  );
}