import { createFileRoute } from "@tanstack/react-router";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicPage } from "@/components/layout/PublicPage";

export const Route = createFileRoute("/tos")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions | MatchMax" },
      {
        name: "description",
        content:
          "The MatchMax Terms and Conditions — the terms that govern your use of MatchMax.hk and MatchMax's tutoring services.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: TermsOfUsePage,
});

type Block = { kind: "p"; text: string } | { kind: "ul"; items: string[] };

const INTRO_TEXT = `MatchMax Terms of Service
Effective date: September 15, 2026
Operator: Hau Yui Chan, trading as MatchMax (“MatchMax”, “we”, “us”)
Business Registration number: 41690777
Address: Shop T163, 3/F, The Capital, 61–65 Chatham Road South, Tsim Sha Tsui, Kowloon, Hong Kong
Email: contact@matchmax.hk`;

const SECTIONS: { title: string; blocks: Block[] }[] = [
  {
    title: "1. Scope, definitions and acceptance",
    blocks: [
      {
        kind: "p",
        text: "These Terms govern MatchMax’s website and tutor-directory, matching, introduction, communication and related support services (“Platform”).",
      },
      {
        kind: "p",
        text: "A User is a visitor, account holder, Customer, Learner, Tutor or Tutor applicant. A Customer is an adult aged 18 or above contracting for tutoring for themselves or another Learner, who receives the tutoring. A Tutor is an independent tutoring-service provider listed or introduced through MatchMax. A Minor is anyone under 18.",
      },
      {
        kind: "p",
        text: "An Authorised Channel is the website, a contact method published on it, or another contact method specifically confirmed through a published MatchMax contact.",
      },
      {
        kind: "p",
        text: "You accept applicable Terms by clicking “Accept” on a notice identifying and providing access to them, or expressly agreeing to identified Terms through an Authorised Channel. Browsing, account creation or third-party sign-in alone does not constitute acceptance or create a payment obligation. After account creation, Platform functions remain blocked pending acceptance, except access to legal notices and support. Clicking “Decline” automatically deletes the newly created account; associated personal data is handled under the Privacy Policy’s retention provisions. This acceptance does not replace any separately required adult confirmation, acceptance of Tutor Terms or Fee Agreements, or publication authorisation.",
      },
      {
        kind: "p",
        text: "Separately presented and affirmatively accepted Tutor terms (“Tutor Terms”) and fee agreements (“Fee Agreements”) form part of your Platform agreement. Fee Agreements govern fee-specific matters, Tutor Terms govern Tutor-specific matters, and these Terms otherwise prevail.",
      },
      {
        kind: "p",
        text: "Nothing limits MatchMax’s rights under applicable law concerning unauthorised access, scraping, intellectual-property infringement, misuse of personal data or other unlawful conduct, whether or not the person accepted these Terms.",
      },
    ],
  },
  {
    title: "2. Accounts, eligibility and Minors",
    blocks: [
      {
        kind: "p",
        text: "Users aged 13–17 may use the age-appropriate functions made available to them, including privately saving public Tutor listings, submitting initial tutoring enquiries to MatchMax, expressing Tutor preferences and proposing availability. These activities are preliminary only and do not confirm a booking or create a payment obligation.",
      },
      {
        kind: "p",
        text: "Before MatchMax provides an Introduction involving a Minor Learner, releases a Tutor’s non-public contact information or enables direct Customer–Tutor–Learner communications, a parent, guardian or adult authorised by them must directly confirm through an Authorised Channel that they will act as Customer and accept the applicable Platform Terms. A Minor’s statement that an adult has consented is insufficient.",
      },
      {
        kind: "p",
        text: "Once an adult Customer has been confirmed, a Minor Learner may participate in learning-related communications and propose lesson arrangements or scheduling changes through channels accessible to that Customer. The Customer must agree bookings and material amendments directly with the Tutor, including changes affecting tuition, cancellation charges or other payment obligations.",
      },
    ],
  },
  {
    title: "3. MatchMax’s role and Tutor independence",
    blocks: [
      {
        kind: "p",
        text: "An Introduction occurs when MatchMax materially facilitates initial contact between a Customer and Tutor, including by sharing non-public identifying or contact information or establishing a communication. Subsequent external communication does not undo an Introduction.",
      },
      {
        kind: "p",
        text: "A preliminary enquiry submitted by a Minor to MatchMax, or internal matching carried out without establishing contact or sharing non-public Tutor information, does not itself constitute an Introduction. Introductions involving Minor Learners must follow the adult-confirmation process in section 2.",
      },
      {
        kind: "p",
        text: "MatchMax facilitates contact, transmits information and provides administrative support. It does not provide tutoring or become a party to the Customer–Tutor contract (“Lesson Contract”). Unless expressly agreed in writing for a specific matter, MatchMax is not either party’s agent and cannot agree lesson terms, make representations or incur obligations on their behalf.",
      },
      {
        kind: "p",
        text: "Tutors independently accept requests, set or approve rates and availability, control ordinary teaching methods and materials, supply ordinary equipment, bear their expenses and business risk, and may work elsewhere. MatchMax guarantees no work or earnings. Rejecting an unconfirmed request does not itself incur a fee or reliability penalty.",
      },
      {
        kind: "p",
        text: "Tutors must comply with applicable tax, business-registration, insurance, immigration, work-permission and professional requirements. They must not claim to be MatchMax employees, bind MatchMax, share accounts or use unauthorised substitutes.",
      },
      {
        kind: "p",
        text: "No employment, partnership, joint venture, fiduciary relationship or general agency is intended. Nothing overrides a legal relationship or obligation arising from the actual circumstances or mandatory law.",
      },
    ],
  },
  {
    title: "4. Tutor evidence, verification and AI",
    blocks: [
      {
        kind: "p",
        text: "Tutors and applicants must provide genuine, complete, accurate and non-misleading information and evidence, identify redactions and promptly correct material inaccuracies. Evidence must not be falsified or deceptively altered.",
      },
      {
        kind: "p",
        text: "Before listing a Tutor, MatchMax reviews selected claims concerning academic qualifications, results, awards, achievements or relevant experience against evidence supplied by that Tutor. MatchMax exercises reasonable care and skill in that review; its scope depends on the claims and evidence reasonably available.",
      },
      {
        kind: "p",
        text: "“Verified” means only completion of that limited review using the evidence available at the time. Other profile statements may be self-reported. Unless expressly stated, MatchMax does not independently authenticate evidence, contact original sources or conduct identity, criminal-record, reference, employment-history, immigration, work-permission, professional-registration or safeguarding checks.",
      },
      {
        kind: "p",
        text: "Verification is not accreditation, endorsement or a guarantee of authenticity, accuracy, completeness, suitability, safety, teaching quality, availability, future conduct or academic results. False, altered or misleading evidence may remain undetected.",
      },
      {
        kind: "p",
        text: "MatchMax may request further evidence, reject applications, or correct, restrict or remove listings where information is unsupported, outdated, disputed or reasonably suspected to be misleading.",
      },
      {
        kind: "p",
        text: "MatchMax may use external AI or automated-processing services to extract or pre-fill submitted information. Output may be inaccurate or incomplete and does not authenticate evidence or independently approve or reject applications. Tutors must check extracted information, and MatchMax will conduct human review before publication or an application decision materially relying on it.",
      },
    ],
  },
  {
    title: "5. Lessons, tuition and cancellations",
    blocks: [
      {
        kind: "p",
        text: "A listing, enquiry, shortlist or Introduction does not itself confirm a lesson. Customers and Tutors form their Lesson Contract directly by communicating agreement to material arrangements with an intention to be bound.",
      },
      {
        kind: "p",
        text: "The parties should retain a written record identifying the Tutor and Learner, subject, tuition fee, duration, schedule, format, location and cancellation, rescheduling, lateness, no-show and refund terms. For Minor Learners, the adult Customer must agree material arrangements and amendments.",
      },
      {
        kind: "p",
        text: "MatchMax’s confirmation records are evidence only of what the parties actually agreed. They do not create unagreed terms or make MatchMax a contracting party.",
      },
      {
        kind: "p",
        text: "As conditions of Platform use:",
      },
      {
        kind: "ul",
        items: [
          "Tutors must provide the agreed tutoring and duration with reasonable care and skill, maintain materially accurate profiles and address reasonable service concerns.",
          "Customers must provide accurate and proportionate learning requirements, pay agreed tuition and arrange a reasonably safe lesson environment and appropriate adult involvement.",
        ],
      },
      {
        kind: "p",
        text: "Unless MatchMax expressly introduces a separate payment facility, tuition is payable directly to Tutors. MatchMax does not receive or safeguard tuition, collect payment credentials, provide escrow, control external payment services, reverse payments or guarantee payment or refunds.",
      },
      {
        kind: "p",
        text: "Another person may pay with the Customer’s authority, subject to payment-provider rules. This does not make that person the Customer or discharge the Customer’s payment obligation beyond the amount properly paid. Tutors must confirm receipt and provide appropriate payment acknowledgments.",
      },
      {
        kind: "p",
        text: "Lesson payment, cancellation and refund disputes remain between Customer and Tutor. MatchMax does not guarantee either party’s performance, replacement tutoring or recovery of payments.",
      },
    ],
  },
  {
    title: "6. MatchMax fees",
    blocks: [
      {
        kind: "p",
        text: "No fee is payable to MatchMax under these Terms alone.",
      },
      {
        kind: "p",
        text: "A fee requires a separate written Fee Agreement identifying the payer, amount or calculation, chargeable service, payment trigger, due date and applicable cancellation or refund terms, affirmatively accepted by the payer before the chargeable service.",
      },
      {
        kind: "p",
        text: "Tutors accept fees payable by Tutors; adult Customers accept fees payable by Customers. This applies also to arrangements involving Minor Learners. Minors cannot accept Fee Agreements.",
      },
      {
        kind: "p",
        text: "Users must not knowingly conceal or misdescribe arrangements to avoid an accepted, lawful fee. External communication and direct tuition payments are not themselves prohibited and create no additional fee.",
      },
      {
        kind: "p",
        text: "MatchMax may request proportionate, appropriately redacted evidence relevant to an agreed fee. Failure to pay an undisputed amount when due is a material breach and may result in suspension or termination and lawful recovery.",
      },
      {
        kind: "p",
        text: "MatchMax will not provide services requiring a licence or authorisation it does not hold, or impose or collect fees prohibited by applicable law.",
      },
    ],
  },
  {
    title: "7. Safeguarding and acceptable use",
    blocks: [
      {
        kind: "p",
        text: "Users must act lawfully, respectfully and professionally in connection with the Platform and tutoring arranged through it. Prohibited conduct includes:",
      },
      {
        kind: "ul",
        items: [
          "fraud, impersonation, harassment, threats, unlawful discrimination, abuse, grooming or exploitation;",
          "sexual or romantic conduct involving a Minor, sexualised or inappropriate communications, asking a Minor to conceal communications or events, or using secret or disappearing messages with a Minor;",
          "unnecessary or inappropriate physical contact, transporting or recording a Minor without appropriate adult authorisation, or publishing Learner information or recordings without lawful authority;",
          "home lessons in a Minor’s bedroom or similarly inappropriate private area, or alcohol, illegal drugs or weapons during lessons;",
          "examination impersonation, completing assessed work for a Learner, plagiarism, falsified results or unauthorised access to examination materials;",
          "malicious software, unauthorised access, interference with security, scraping or systematic copying without permission, or manipulation of Platform records or processes;",
          "knowingly false, misleading or defamatory content, intellectual-property infringement, misuse of personal data or unsolicited marketing using Platform information; and",
          "requesting passwords or financial credentials, misrepresenting age or circumventing access restrictions.",
        ],
      },
      {
        kind: "p",
        text: "Legitimate teaching, feedback and draft review are permitted; presenting a Tutor’s work as the Learner’s own is not.",
      },
      {
        kind: "p",
        text: "Home lessons involving a Minor should ordinarily take place in an appropriate common area. Customers must arrange supervision appropriate to the Learner’s age and circumstances and remain reasonably contactable.",
      },
      {
        kind: "p",
        text: "MatchMax may restrict communications, pause Introductions, suspend access and lawfully preserve or disclose relevant evidence where reasonably necessary to address safeguarding, suspected fraud or legal concerns.",
      },
      {
        kind: "p",
        text: "Nothing restricts emergency assistance, lawful reporting or lawful evidence preservation, or limits obligations under the Mandatory Reporting of Child Abuse Ordinance (Cap. 650), where applicable. Obstructing legally required reports, retaliation against lawful reporters and unlawful disclosure of reporters’ identities are prohibited.",
      },
      {
        kind: "p",
        text: "MatchMax is not an emergency or childcare service.",
      },
    ],
  },
  {
    title: "8. Privacy, profiles and intellectual property",
    blocks: [
      {
        kind: "p",
        text: "MatchMax handles personal data under applicable law, its Privacy Policy and relevant Personal Information Collection Statements. Users must have lawful authority to disclose another person’s data and provide only reasonably necessary information.",
      },
      {
        kind: "p",
        text: "Tutors may use Customer and Learner data only for the relevant enquiry, tutoring, payment, safeguarding and directly related lawful purposes, and must not disclose it without lawful authority.",
      },
      {
        kind: "p",
        text: "Registration does not create a public profile. Accounts operated by Minors are non-public. Saving a Tutor listing does not authorise disclosure of the account holder’s identity, contact details or account information to that Tutor.",
      },
      {
        kind: "p",
        text: "Users retain ownership of submitted content and grant MatchMax a non-exclusive, royalty-free licence to store, reproduce, format and display it, including through service providers acting on MatchMax’s behalf, only as reasonably necessary to operate the Platform and relevant listing. Users must hold the necessary rights.",
      },
      {
        kind: "p",
        text: "Before publishing a new Tutor profile, MatchMax will present the proposed public information for review and correction and obtain express publication authorisation through an unticked-by-default checkbox or an Authorised Channel. Non-material editing is permitted; materially new personal information requires further authorisation unless already requested or expressly approved by the Tutor.",
      },
      {
        kind: "p",
        text: "MatchMax may correct, restrict or remove content for accuracy, privacy, safeguarding, legal compliance or Platform integrity.",
      },
      {
        kind: "p",
        text: "Other Platform intellectual property belongs to MatchMax or its licensors. Users receive only a limited, non-exclusive, non-transferable and revocable right to use it for its intended purpose.",
      },
    ],
  },
  {
    title: "9. Communications and third-party services",
    blocks: [
      {
        kind: "p",
        text: "MatchMax may provide services through authorised employees, contractors, freelancers or agents acting within their authority. Variations of these Terms, fee waivers, outcome guarantees and financial commitments on MatchMax’s behalf require express confirmation by the operator through an Authorised Channel, subject to applicable law.",
      },
      {
        kind: "p",
        text: "Using MatchMax’s name, branding or public information does not itself establish authority. Users should verify unusual payment instructions and sensitive-information requests through published contact details. MatchMax will not request passwords, authentication codes, complete card-security codes or banking or payment-login credentials.",
      },
      {
        kind: "p",
        text: "External authentication, messaging, social-media and payment services operate independently under their own terms and privacy practices. MatchMax does not guarantee their security or availability. Responsibility for external-service failures and impersonation is subject to section 11.",
      },
    ],
  },
  {
    title: "10. Complaints, restrictions and termination",
    blocks: [
      {
        kind: "p",
        text: "Questions, complaints and legal notices should be sent to the contact details above. Users should promptly report material non-performance, suspected fraud and security concerns, and report safeguarding concerns immediately.",
      },
      {
        kind: "p",
        text: "MatchMax may request relevant, appropriately redacted evidence, investigate and take proportionate action, including correcting content, recording documented reliability incidents, pausing Introductions or restricting or terminating access, where it reasonably believes there is:",
      },
      {
        kind: "ul",
        items: [
          "a material breach, false or misleading information, or misuse of personal data;",
          "a safeguarding, security, fraud or other material legal risk;",
          "repeated failure to perform confirmed lesson arrangements; or",
          "an undisputed overdue fee payable to MatchMax.",
        ],
      },
      {
        kind: "p",
        text: "Urgent protective action may be immediate. MatchMax will provide a general reason and reasonable opportunity to respond where practicable, appropriate and lawful.",
      },
      {
        kind: "p",
        text: "Platform decisions do not conclusively determine the parties’ legal rights. Rematching and dispute assistance are discretionary unless separately agreed.",
      },
      {
        kind: "p",
        text: "Users may close their accounts. Closure does not discharge accrued obligations or automatically cancel Lesson Contracts. Records may be retained where reasonably necessary and lawful.",
      },
      {
        kind: "p",
        text: "MatchMax may maintain, modify, restrict or discontinue Platform functions, giving reasonable notice where practicable and subject to accepted Fee Agreements and applicable law.",
      },
    ],
  },
  {
    title: "11. Disclaimers and liability",
    blocks: [
      {
        kind: "p",
        text: "MatchMax does not guarantee Tutor availability, compatibility, evidence authenticity, safety, academic outcomes, replacement Tutors, external payment recovery or uninterrupted, secure or error-free operation. These disclaimers do not remove MatchMax’s obligation to perform its own services with reasonable care and skill.",
      },
      {
        kind: "p",
        text: "Nothing in the Platform agreement excludes or limits liability for:",
      },
      {
        kind: "ul",
        items: [
          "MatchMax’s fraud or fraudulent misrepresentation;",
          "death or personal injury caused by MatchMax’s negligence;",
          "liability arising under the Supply of Services (Implied Terms) Ordinance (Cap. 457) that cannot lawfully be excluded or restricted against a consumer;",
          "mandatory personal-data or consumer-protection rights; or",
          "any other liability that cannot lawfully be excluded or limited.",
        ],
      },
      {
        kind: "p",
        text: "Subject to those exceptions, and only where fair, reasonable and legally enforceable:",
      },
      {
        kind: "p",
        text: "MatchMax is responsible for direct, reasonably foreseeable loss caused by its breach or negligence, including conduct for which it is legally responsible.",
      },
      {
        kind: "p",
        text: "MatchMax is not responsible for independent Tutor, Customer or third-party conduct, inaccurate User information, external-service failures, impersonation or events outside its reasonable control, except to the extent caused by its breach or negligence or conduct for which it is legally responsible.",
      },
      {
        kind: "p",
        text: "MatchMax is not liable for indirect or consequential loss or, for business Users, lost profits, revenue, earnings, business, contracts, opportunities, savings, goodwill or reputation.",
      },
      {
        kind: "p",
        text: "MatchMax’s total aggregate liability to a claimant arising from one event or connected events, whether in contract, tort including negligence, or otherwise, is limited to the greater of HK$10,000 and fees that claimant paid to MatchMax under accepted Fee Agreements during the 12 months immediately preceding the event giving rise to the claim. Tuition paid to Tutors is excluded from this calculation.",
      },
      {
        kind: "p",
        text: "Each exclusion and limitation applies separately. Claimants must take reasonable steps to mitigate loss and cannot recover more than once for the same loss.",
      },
    ],
  },
  {
    title: "12. Indemnities",
    blocks: [
      {
        kind: "p",
        text: "To the extent reasonable and lawful, Tutors indemnify MatchMax against third-party claims and reasonable, properly incurred costs directly caused by their:",
      },
      {
        kind: "ul",
        items: [
          "fraud, negligence, unlawful tutoring or safeguarding misconduct;",
          "intellectual-property infringement or misuse of personal data;",
          "unauthorised substitution or knowingly false or unauthorised profile content; or",
          "breach of applicable tax, immigration, business-registration or professional obligations relating to their tutoring.",
        ],
      },
      {
        kind: "p",
        text: "Customers indemnify MatchMax only against third-party claims and reasonable, properly incurred costs directly caused by their fraudulent or unlawful Platform use.",
      },
      {
        kind: "p",
        text: "No indemnity applies to a Minor or requires payment of a disproportionate or legally unrecoverable amount. Each indemnity excludes loss to the extent caused by MatchMax’s own breach, negligence or wrongdoing.",
      },
      {
        kind: "p",
        text: "MatchMax must give reasonable notice of a claim, mitigate loss and permit reasonable participation in the defence. No settlement may impose obligations on the indemnifying person without their consent, not unreasonably withheld.",
      },
    ],
  },
  {
    title: "13. Changes and general provisions",
    blocks: [
      {
        kind: "p",
        text: "Updates apply prospectively. Material changes will be notified before taking effect and expressly accepted before materially affected functions continue. No update retrospectively changes accrued obligations or Lesson Contracts without lawful authority or the affected parties’ agreement.",
      },
      {
        kind: "p",
        text: "MatchMax may retain proportionate records of acceptance, authorisation and Introductions. These are evidence, not conclusive proof.",
      },
      {
        kind: "p",
        text: "These Terms and separately accepted Tutor Terms and Fee Agreements comprise the Platform agreement. No separate document creates an obligation unless made reasonably available and affirmatively accepted before that obligation arose. Nothing in this entire-agreement provision excludes liability for actionable misrepresentation.",
      },
      {
        kind: "p",
        text: "Invalid provisions are severable. Failure to enforce a provision is not a waiver.",
      },
      {
        kind: "p",
        text: "Users cannot transfer their account or Platform agreement without MatchMax’s consent. MatchMax may transfer its agreement in a genuine business sale or restructuring, subject to applicable law and any required consent, without reducing accrued rights.",
      },
      {
        kind: "p",
        text: "Accrued rights and provisions intended to survive termination, including accrued fees, intellectual property, lawful data-use restrictions, liability and indemnities, remain effective.",
      },
      {
        kind: "p",
        text: "Non-parties have no enforcement rights under the Contracts (Rights of Third Parties) Ordinance (Cap. 623).",
      },
      {
        kind: "p",
        text: "Hong Kong law governs. Hong Kong courts have jurisdiction, subject to applicable mandatory rights.",
      },
    ],
  },
  {
    title: "14. Contact",
    blocks: [
      {
        kind: "p",
        text: "For additional information and in case you have any questions about these Terms, please contact contact@matchmax.hk.",
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

function TermsOfUsePage() {
  return (
    <PublicPage>
      <PageIntro
        description="The ground rules for using MatchMax — what you can expect from us and what we expect from you."
        eyebrow="Legal"
        meta="Effective 15 September 2026"
        title="Terms and Conditions"
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
          </div>
        </PageContainer>
      </section>
    </PublicPage>
  );
}
