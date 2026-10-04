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

export const INTRO_TEXT = `MatchMax Privacy Policy
Effective date: September 15, 2026
Data user: Hau Yui Chan, trading as MatchMax (“MatchMax”, “we”, “us”)
Business Registration number: 41690777
Address: Shop T163, 3/F, The Capital, 61–65 Chatham Road South, Tsim Sha Tsui, Kowloon, Hong Kong
Privacy contact: MatchMax Data Protection Contact
Email: contact@matchmax.hk`;

type Block = { kind: "p"; text: string } | { kind: "ul"; items: string[] };

const SECTIONS: { title: string; blocks: Block[] }[] = [
  {
    title: "1. Scope and collection notices",
    blocks: [
      {
        kind: "p",
        text: "This Policy explains how MatchMax handles personal data through its website and Authorised Channels under Hong Kong’s Personal Data (Privacy) Ordinance (Cap. 486) (“PDPO”). Undefined capitalised terms have the meanings given in the MatchMax Terms of Service.",
      },
      {
        kind: "p",
        text: "Relevant Personal Information Collection Statements explain collection purposes, required and optional information, consequences of non-provision, recipient classes and access and correction arrangements. Required fields will be identified; without necessary information, we may be unable to provide the relevant function or service. Optional information may be omitted.",
      },
      {
        kind: "p",
        text: "Account creation and acceptance. We process registration and authentication data to create and secure an account pending acceptance of the applicable Terms. Platform functions remain blocked until acceptance. Clicking “Decline” automatically deletes the newly created account. We take all practicable steps to erase associated personal data no longer required; limited response records, security records and restricted backups may remain only as necessary and lawful under Section 9. We may retain proportionate records identifying the Terms version presented, your response and its time. If you make no choice, the account remains blocked and its data remains subject to Section 9. Acceptance of the Terms is not consent to unrelated uses of personal data.",
      },
    ],
  },
  {
    title: "2. Personal data collected",
    blocks: [
      {
        kind: "p",
        text: "Depending on your use of MatchMax, we may collect:",
      },
      {
        kind: "ul",
        items: [
          "Account information: names, country or region, email, telephone or WhatsApp number, account settings, saved listings and preferences.",
          "Authentication and eligibility information: provider identifiers, security records, age eligibility, adult identity and authority, and consent, authorisation and acceptance records. Google or other sign-in providers may supply names, emails, profile images and authentication information under the permissions requested.",
          "Tutor information: education, institutions, programmes, qualifications, academic results and component scores, languages, subjects, teaching materials, experience, achievements, authorised feedback, rates, availability, lesson formats and profile content.",
          "Verification information: submitted documents, images, extracted information, review records, outcomes and dates.",
          "Service information: learning requirements, location and MTR-station preferences, travel ranges, enquiries, communications handled by or supplied to MatchMax, Introductions, lesson arrangements, attendance and documented reliability incidents.",
          "Business and safety records: Fee Agreements, confirmations, invoices, receipts, redacted transaction evidence, complaints, disputes, safeguarding concerns, suspected fraud and Platform-conduct records.",
          "Technical information: IP addresses, device and browser information, cookies, sessions, security and usage logs.",
        ],
      },
      {
        kind: "p",
        text: "Information may come from you, authorised adults, other relevant Users, referees, authentication and communication providers, other service providers, banks, payment providers, relevant public sources and competent authorities.",
      },
      {
        kind: "p",
        text: "Provide another person’s data only with lawful authority and only where reasonably necessary. Redact unrelated information and promptly correct material inaccuracies. MatchMax does not collect payment credentials; do not submit banking passwords, authentication codes or card-security codes.",
      },
    ],
  },
  {
    title: "3. Purposes",
    blocks: [
      {
        kind: "p",
        text: "We use personal data as reasonably necessary to:",
      },
      {
        kind: "ul",
        items: [
          "operate, authenticate, secure and administer accounts, eligibility and age-based restrictions;",
          "respond to enquiries, facilitate searches, Introductions and authorised communications, and record arrangements;",
          "assess Tutor applications, review evidence, investigate misleading claims and manage authorised profiles;",
          "administer separately accepted lawful fees and maintain relevant records;",
          "handle support, complaints, disputes, safeguarding, fraud and misuse;",
          "comply with legal, accounting and regulatory obligations and establish, exercise or defend legal rights.",
        ],
      },
      {
        kind: "p",
        text: "We improve Platform operation using aggregated or appropriately anonymised information.",
      },
      {
        kind: "p",
        text: "Personal data will not be used for a purpose other than its original collection purpose or a directly related purpose without prescribed consent, unless an applicable legal exemption permits that use.",
      },
      {
        kind: "p",
        text: "We do not currently use or provide personal data for direct marketing. Necessary account, application, enquiry, administrative and safety communications may still be sent.",
      },
    ],
  },
  {
    title: "4. Minors",
    blocks: [
      {
        kind: "p",
        text: "Persons under 13 may not operate accounts. Users aged 13–17 may privately save listings, submit preliminary enquiries to MatchMax, express preferences and propose availability under the Terms.",
      },
      {
        kind: "p",
        text: "Before an Introduction, release of non-public Tutor contact information or direct Customer–Tutor–Learner communications involving a Minor, the adult Customer must directly confirm their role and accept the applicable Terms. Afterwards, the Minor may participate through channels accessible to that Customer; the Customer must agree bookings, material changes and payment obligations.",
      },
      {
        kind: "p",
        text: "Minor accounts and saved listings are non-public. Registration, saving a listing or submitting a preliminary enquiry does not itself authorise disclosure of the Minor’s identity or contact details to a Tutor.",
      },
      {
        kind: "p",
        text: "We collect only necessary account, eligibility, learning and safeguarding information. Authorised adults may provide necessary information about Minor Learners, including those under 13. Exact birth dates, identity documents, school identifiers, photographs, private contact details and precise locations should not be supplied unless specifically requested and reasonably necessary.",
      },
      {
        kind: "p",
        text: "We provide age-appropriate collection and sharing explanations and seek parent or guardian involvement or authorisation where necessary. We may use proportionate age and authority checks, restrict ineligible accounts and erase unnecessary data under Section 9.",
      },
    ],
  },
  {
    title: "5. Public Tutor profiles",
    blocks: [
      {
        kind: "p",
        text: "Only Tutors aged 18 or above may have public profiles. Applications and supporting evidence are not automatically public.",
      },
      {
        kind: "p",
        text: "Before publication, we present the proposed public information for review and correction and obtain express authorisation through an unticked-by-default checkbox or an Authorised Channel. Materially new personal information requires further authorisation unless already expressly approved.",
      },
      {
        kind: "p",
        text: "Profiles may include authorised names or codes, photographs, education, qualifications, results, achievements, experience, languages, subjects, rates, availability, lesson formats and approximate service areas.",
      },
      {
        kind: "p",
        text: "Public information may be copied, indexed or cached by others. Tutors may request correction or removal, but removal from MatchMax cannot ensure deletion of independently held copies.",
      },
    ],
  },
  {
    title: "6. Disclosure",
    blocks: [
      {
        kind: "p",
        text: "We disclose only relevant, reasonably necessary personal data, as permitted by law, to:",
      },
      {
        kind: "ul",
        items: [
          "Customers, Tutors and participating Learners involved in authorised enquiries, Introductions or communications, subject to Section 4;",
          "the public, search engines and third-party platforms, for authorised public-profile information;",
          "authorised employees, contractors, freelancers and agents;",
          "hosting, authentication, communications, storage, document-processing, AI, security, support, invoicing and related service providers;",
          "banks and payment providers handling MatchMax fees;",
          "professional advisers, insurers and auditors;",
          "competent authorities and appropriate recipients for lawful reporting, safeguarding, investigations or legal proceedings; and",
          "prospective or actual purchasers or successors in a genuine business sale or restructuring, subject to confidentiality and applicable purpose restrictions.",
        ],
      },
      {
        kind: "p",
        text: "Before enabling shared communications, we explain relevant visibility of participants’ names, contact details, profile images and messages.",
      },
      {
        kind: "p",
        text: "Independent Tutors and external services handle data under their own applicable obligations and privacy practices. This does not exclude MatchMax’s responsibilities for its own processing or processing on its behalf.",
      },
    ],
  },
  {
    title: "7. External processing, AI and security",
    blocks: [
      {
        kind: "p",
        text: "Service providers may process personal data outside Hong Kong, where laws may differ. We adopt contractual or other means to restrict processing to authorised purposes, address access, security and subcontracting, and prevent retention longer than necessary.",
      },
      {
        kind: "p",
        text: "External AI or automated services may extract or pre-fill information submitted by adult Tutor applicants. Output may be inaccurate and does not authenticate evidence or independently determine applications. Applicants must check extracted information; MatchMax conducts human review before publication or an application decision materially relying on it. Submission for verification does not itself authorise unrelated AI-model training.",
      },
      {
        kind: "p",
        text: "We take reasonably practicable organisational and technical measures appropriate to the data against unauthorised or accidental access, processing, loss, erasure or use. No system guarantees absolute security. Protect your credentials and promptly report suspected misuse.",
      },
    ],
  },
  {
    title: "8. Cookies",
    blocks: [
      {
        kind: "p",
        text: "We may use cookies and similar technologies for sign-in, session management, security and preferences, and collect technical and usage information for troubleshooting and administration. Relevant service providers may process this information under Sections 6–7.",
      },
      {
        kind: "p",
        text: "You can manage cookies through your browser; blocking them may disable functions. Additional tracking, if used, will be explained through an appropriate notice, with consent obtained where required.",
      },
    ],
  },
  {
    title: "9. Retention and deletion",
    blocks: [
      {
        kind: "p",
        text: "We retain data only as necessary for its permitted purposes, considering account and application status, service administration, verification, safeguarding, security, disputes and applicable legal or accounting requirements.",
      },
      {
        kind: "p",
        text: "We normally erase Tutor verification documents and other source evidence within 30 days after the relevant verification or application review is completed or closed, including approved, rejected, withdrawn and closed applications. Relevant evidence may be retained longer where reasonably necessary for an investigation, complaint, safeguarding matter, dispute, legal claim or legal obligation.",
      },
      {
        kind: "p",
        text: "Necessary extracted information, verification outcomes, publication approvals and acceptance records may be retained separately. Accounting requirements do not themselves justify retaining transcripts or supporting evidence.",
      },
      {
        kind: "p",
        text: "Restricted backup copies may remain until deleted or overwritten through the normal backup cycle and will not be used for ordinary business purposes.",
      },
      {
        kind: "p",
        text: "Any User, including a Minor, may request account closure or deletion through the privacy contact. We erase or appropriately anonymise data no longer required; closure does not automatically erase records still lawfully necessary.",
      },
    ],
  },
  {
    title: "10. Access, correction and privacy requests",
    blocks: [
      {
        kind: "p",
        text: "Subject to the PDPO, you may ask whether we hold your personal data, obtain a copy and request correction of inaccurate data. Please use the Privacy Commissioner’s current Data Access Request Form OPS003 for formal access requests. We may reasonably verify identity and authority and request information needed to locate the data.",
      },
      {
        kind: "p",
        text: "We handle access and correction requests within applicable statutory periods, ordinarily 40 days, and provide required notices where compliance is delayed or refused. We may charge a lawful, non-excessive fee for access requests; correction requests are free.",
      },
      {
        kind: "p",
        text: "Minors may exercise their own rights. Persons with parental responsibility or other legally authorised representatives may act on their behalf where permitted by law, subject to verification. Acting as Customer does not itself confer unrestricted access to a Minor’s records.",
      },
      {
        kind: "p",
        text: "You may withdraw consent by written notice where processing depends on it, without affecting processing or retention otherwise permitted by law.",
      },
      {
        kind: "p",
        text: "Send requests, questions or complaints to the MatchMax Data Protection Contact at the email or postal address above. You may also complain to Hong Kong’s Privacy Commissioner for Personal Data.",
      },
    ],
  },
  {
    title: "11. Changes",
    blocks: [
      {
        kind: "p",
        text: "Updates apply prospectively. We will appropriately notify material changes and obtain further consent where required. An update does not itself authorise an unrelated new use of previously collected data. Nothing in this Policy excludes mandatory privacy rights or MatchMax’s legal obligations.",
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
        meta="Current as of 15 September 2026"
        title="Privacy Policy"
      />

      <section className="py-14 sm:py-20">
        <PageContainer width="narrow">
          <div className="space-y-12">
            <div className="border-b border-border pb-12 text-base leading-7 text-muted-foreground">
              <p className="whitespace-pre-wrap">{INTRO_TEXT}</p>
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
