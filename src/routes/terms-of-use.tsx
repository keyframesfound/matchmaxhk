import { createFileRoute } from "@tanstack/react-router";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicPage } from "@/components/layout/PublicPage";

export const Route = createFileRoute("/terms-of-use")({
  head: () => ({
    meta: [
      { title: "Terms of Use | MatchMax" },
      {
        name: "description",
        content: "The terms that govern your use of the MatchMax tutoring platform.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: TermsOfUsePage,
});

export const INTRO_TEXT =
  "Welcome to MatchMax. These Terms of Use ('Terms') govern your access to and use of matchmax.hk and any related services provided by MatchMax ('MatchMax', 'we', 'us' or 'our'). By accessing or using the platform, submitting any form, or creating an account, you agree to be bound by these Terms. If you do not agree, please do not use the platform.";

const SECTIONS = [
  {
    title: "About the Platform",
    intro:
      "MatchMax is an online platform that connects parents and students in Hong Kong with tutors for 1-on-1 tutoring. We help families publish tutoring requests ('cases'), browse tutor profiles, and contact tutors whose services meet their needs.",
    points: [
      "MatchMax is an introductory platform. Tutoring arrangements, including scheduling, rates and lesson content, are made directly between parents and tutors.",
      "We verify tutor credentials where indicated, but we do not employ tutors and are not a party to any agreement between a parent and a tutor.",
    ],
    closing: "",
  },
  {
    title: "Eligibility and Accounts",
    intro:
      "You must be at least 18 years old to submit forms or create an account on MatchMax. Parents submitting requests on behalf of a minor confirm they are the parent or legal guardian of that student.",
    points: [],
    closing:
      "You agree to provide accurate, current and complete information in all forms and profiles, and to keep it up to date. We may suspend or remove accounts that contain false or misleading information.",
  },
  {
    title: "Tutor Obligations",
    intro:
      "Tutors applying through the Join form confirm that the academic results, qualifications and experience they submit are true and belong to them.",
    points: [
      "Tutors must conduct themselves professionally and arrive prepared for lessons arranged through the platform.",
      "Tutors must honour the commission arrangement agreed with MatchMax for cases sourced through the platform.",
      "Tutors must protect student privacy and must not share, publish or misuse any student's personal information.",
    ],
    closing:
      "MatchMax may decline, suspend or remove a tutor's profile at its sole discretion, including where results or credentials cannot be verified.",
  },
  {
    title: "Parent and Student Obligations",
    intro:
      "Parents and students using the Request a Tutor form agree to provide genuine requests and to communicate respectfully with tutors and the MatchMax team.",
    points: [
      "Lesson fees, timing and cancellation terms are agreed directly with the tutor before lessons begin.",
      "Parents are responsible for supervising minors during lessons arranged through the platform.",
    ],
    closing: "",
  },
  {
    title: "Fees and Commission",
    intro:
      "Browsing and submitting requests on MatchMax is free for parents. Tutors agree to pay the commission on cases introduced through MatchMax as set out in their application acknowledgement or any separate written agreement with us.",
    points: [],
    closing:
      "We may change our fees or commission structure prospectively with reasonable notice. Continued use of the platform after such notice constitutes acceptance of the new fees.",
  },
  {
    title: "No Guarantee of Results",
    intro:
      "MatchMax showcases tutors' academic results and experience, but we do not guarantee any particular academic outcome, examination grade, or lesson availability. Grades and results shown on profiles are as declared by tutors and verified by us to the extent indicated on each profile.",
    points: [],
    closing: "",
  },
  {
    title: "Acceptable Use",
    intro:
      "When using MatchMax, you agree not to:",
    points: [
      "Harass, abuse, spam or impersonate any person or organisation;",
      "Scrape, harvest or misuse personal data of tutors, students or parents;",
      "Use the platform to offer or solicit services other than legitimate tutoring or admissions support;",
      "Circumvent the platform's commission arrangement for cases introduced through MatchMax;",
      "Upload malicious code or attempt to interfere with the platform's operation.",
    ],
    closing: "",
  },
  {
    title: "Intellectual Property",
    intro:
      "All content on the platform, including text, design, logos and case listings, is owned by MatchMax or licensed to us. Tutor and parent submissions remain the property of their authors, but by submitting content you grant MatchMax a non-exclusive, worldwide licence to display and use it for the purpose of operating the platform.",
    points: [],
    closing: "",
  },
  {
    title: "Limitation of Liability",
    intro:
      "To the maximum extent permitted by law, MatchMax provides the platform 'as is' and 'as available' without warranties of any kind. We are not liable for any loss arising from arrangements made between parents and tutors, including lesson quality, fees, or disputes, except where such liability cannot be excluded under Hong Kong law.",
    points: [],
    closing: "",
  },
  {
    title: "Privacy",
    intro:
      "Your use of the platform is also governed by our Privacy Policy, which explains how we collect, use and protect your personal data in compliance with the Personal Data (Privacy) Ordinance (Cap. 486).",
    points: [],
    closing: "",
  },
  {
    title: "Changes to These Terms",
    intro:
      "We may update these Terms from time to time. The current version will always be posted on this page with the date of the latest revision. Material changes will be highlighted on the platform.",
    points: [],
    closing: "",
  },
];

function TermsOfUsePage() {
  return (
    <PublicPage>
      <PageIntro
        description="The ground rules for using MatchMax — what you can expect from us and what we expect from you."
        eyebrow="Legal"
        meta="Current as of 10 September 2026"
        title="Terms of Use"
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
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
                Questions About These Terms?
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
                For questions about these Terms, or to report a breach, contact us at{" "}
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
