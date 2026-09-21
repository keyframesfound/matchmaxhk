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

type Block = { kind: "p"; text: string } | { kind: "ul"; items: string[] };

const SECTIONS: { title: string; blocks: Block[] }[] = [
  {
    title: "1. Data Collection Methods",
    blocks: [
      {
        kind: "p",
        text: "MatchMax collects personal data strictly necessary to facilitate high-quality educational matching. We collect this data through:",
      },
      {
        kind: "ul",
        items: [
          "**Unauthenticated Web Forms:** Information submitted via guest requests (e.g., subject requirements, location, budget).",
          "**WhatsApp Business App:** Communication logs, scheduling details, and phone numbers captured during the concierge matching process.",
          "**Google OAuth (Single Sign-On):** For users who choose to create an account (mandatory for Tutors), we collect verified email addresses, profile photos, and names associated with the connected Google account.",
        ],
      },
    ],
  },
  {
    title: "2. Account Creation and Guest Requests",
    blocks: [
      {
        kind: "p",
        text: "Clients (parents/students) are not required to create an account to initiate a matching request. By submitting a request as a guest and communicating with our team, users consent to these terms.",
      },
    ],
  },
  {
    title: "3. Document Verification (Tutors)",
    blocks: [
      {
        kind: "p",
        text: "Independent contractors (tutors) applying to the MatchMax directory are required to submit identity and academic verification documents (e.g., transcripts, university credentials). These documents are processed securely via the MatchMax admin dashboard. Verification evidence is stored purely for internal auditing and platform integrity; it is never published publicly or shared with third parties.",
      },
    ],
  },
  {
    title: "4. Data Sharing and Third Parties",
    blocks: [
      {
        kind: "p",
        text: "MatchMax acts as a secure intermediary. We only share the minimum necessary information (e.g., first name, general location, academic requirements) between the specific Client and Tutor involved in a potential match. We do not sell, rent, or trade user data, contact numbers, or communication logs to third-party marketing agencies. All payment data is processed directly via authorized banking rails (FPS/PayMe) and is not stored in plain text on MatchMax servers.",
      },
    ],
  },
  {
    title: "5. Client Feedback and Testimonials",
    blocks: [
      {
        kind: "p",
        text: "Clients (parents/students) are not required to create an account on MatchMax to request a tutor or submit feedback. Following a successful match, MatchMax may send an optional feedback form (e.g., via Google Forms) to monitor quality control. Information collected in these forms is used for internal moderation. If a Client explicitly grants permission within the form, MatchMax may publish their first name, the tutor's name, and their written review publicly on the MatchMax website for marketing purposes.",
      },
    ],
  },
];

function renderInline(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, index) =>
    index % 2 === 1 ? (
      <strong key={index} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

function PrivacyPolicyPage() {
  return (
    <PublicPage>
      <PageIntro
        description="Your privacy matters to us. This policy explains how MatchMax collects and handles your personal data."
        eyebrow="Legal"
        meta="Current as of 21 September 2026"
        title="Privacy Policy"
      />

      <section className="py-14 sm:py-20">
        <PageContainer width="narrow">
          <div className="space-y-12">
            <div className="border-b border-border pb-12 text-base leading-7 text-muted-foreground">
              <p>{INTRO_TEXT}</p>
            </div>

            {SECTIONS.map((section) => (
              <article
                key={section.title}
                className="border-b border-border pb-12 last:border-b-0 last:pb-0"
              >
                <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{section.title}</h2>
                <div className="mt-5 space-y-5 text-base leading-7 text-muted-foreground">
                  {section.blocks.map((block, index) =>
                    block.kind === "ul" ? (
                      <ul
                        key={index}
                        className="list-disc space-y-3 pl-5 marker:text-[color:var(--brand-link)]"
                      >
                        {block.items.map((item, itemIndex) => (
                          <li key={itemIndex} className="pl-1">
                            {renderInline(item)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p key={index} className="whitespace-pre-wrap">
                        {renderInline(block.text)}
                      </p>
                    ),
                  )}
                </div>
              </article>
            ))}

            <article className="border-t border-border pt-12">
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                Questions About Privacy?
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
                For questions about how we handle your data, or to submit a data access or
                correction request, contact us at{" "}
                <a
                  className="font-semibold text-[color:var(--brand-link)] underline underline-offset-4"
                  href="mailto:contact@matchmax.hk"
                >
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
