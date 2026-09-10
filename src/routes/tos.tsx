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

type Block = { kind: "p" | "ul"; text?: string; items?: string[] };

const INTRO_TEXT = `Part A — MatchMax Platform Terms of Service
Effective date: September 8, 2026
Operator: Hau Yui Chan, trading as MatchMax
Business Registration number: 41690777
Registered address: Shop T163, 3/F, The Capital, 61-65 Chatham Road South, Tsim Sha Tsui, Kowloon, Hong Kong
Email: contact@matchmax.hk

These Terms govern MatchMax.hk and MatchMax's tutor-directory, matching, introduction, communication and related support services.`;

const SECTIONS: { title: string; blocks: Block[] }[] = [
  {
    title: "1. Definitions",
    blocks: [
      { kind: "p", text: "In these Terms:" },
      {
        kind: "ul",
        items: [
          "Account means an account registered on MatchMax.hk.",
          "Adult Customer or Customer means a person aged 18 or above who arranges tutoring for themselves or another Learner.",
          "Authorised MatchMax Channel means:",
          "MatchMax.hk;",
          "an email address, telephone number, messaging account or social-media account published on MatchMax.hk; or",
          "another account or contact method that MatchMax has specifically confirmed through a published MatchMax contact.",
          "Authorised MatchMax Representative means a director, employee, contractor, freelancer or agent authorised to perform the relevant task for MatchMax.",
          "Introduction occurs when MatchMax materially facilitates initial contact between a Customer and Tutor, including by providing non-public identifying or contact information or creating a communication between them.",
          "Learner means the person receiving tutoring.",
          "Lesson Contract means the contract for tutoring entered into directly between the Customer and Tutor.",
          "Minor means a person under 18.",
          "Minor Account means an Account registered and operated by a Minor aged 13 or above and restricted to the limited, non-public and non-transactional Account functions made available by MatchMax.",
          "Platform means MatchMax.hk and the related matching, introduction and support services provided through Authorised MatchMax Channels.",
          "Tutor means an independent tutoring-service provider listed or introduced through MatchMax.",
          "Tuition Fee means the amount payable directly to a Tutor for tutoring.",
          "User means a visitor, Account holder, Customer, Learner, Tutor or Tutor applicant.",
          "Fee Agreement means a separate written agreement setting out a fee payable to MatchMax and affirmatively accepted before the relevant chargeable service.",
          "Match Confirmation means a retrievable written record identifying the agreed details of a particular tutoring arrangement or Introduction.",
          "Tutor Terms means any separate terms governing Tutor applications, listings, conduct or use of Tutor-specific Platform functions that a Tutor affirmatively accepts.",
          "Verified Tutor means a Tutor whom MatchMax has approved for listing on the Platform after reviewing selected claims concerning the Tutor's academic qualifications, academic results, awards, achievements and relevant experience against documents or other evidence supplied by the Tutor. \u201cVerified\u201d has only the limited meaning described in section 7.",
        ],
      },
    ],
  },
  {
    title: "2. Acceptance",
    blocks: [
      { kind: "p", text: "A User accepts the provisions applicable to them only by:" },
      {
        kind: "ul",
        items: [
          "ticking a checkbox that is unticked by default and clearly identifies the applicable provisions; or",
          "expressly confirming agreement to the identified provisions through an Authorised MatchMax Channel.",
        ],
      },
      {
        kind: "p",
        text: "Using Google or another third-party sign-in method does not by itself constitute acceptance of these Terms.",
      },
      {
        kind: "p",
        text: "For a Minor, these Terms govern the conditions on which MatchMax permits use of a Minor Account. MatchMax does not rely on a Minor's acceptance to create any Lesson Contract, Fee Agreement, payment obligation, indemnity, guarantee or other financial obligation.",
      },
      {
        kind: "p",
        text: "Nothing done through a Minor Account enables the Minor to act as a Customer or Tutor, request or authorise an Introduction, obtain a Tutor's non-public contact information, enter into or amend a Lesson Contract, accept a Fee Agreement or bind another person.",
      },
      {
        kind: "p",
        text: "MatchMax may restrict or close a Minor Account where the Minor does not comply with the provisions applicable to Account security, acceptable use and permitted use of the Platform.",
      },
      {
        kind: "p",
        text: "MatchMax may require acceptance before completing Account registration, enabling Account functions, processing a Tutor application, providing a non-public Introduction or providing a chargeable service.",
      },
      {
        kind: "p",
        text: "Public browsing alone does not create a Lesson Contract or any payment obligation.",
      },
      {
        kind: "p",
        text: "Nothing in this section limits MatchMax's rights or remedies under applicable law in relation to unauthorised access, scraping, interference, misuse of personal data, intellectual-property infringement or other unlawful conduct.",
      },
    ],
  },
  {
    title: "3. Accounts and eligibility",
    blocks: [
      { kind: "p", text: "Public Tutor listings may be browsed without an Account." },
      {
        kind: "p",
        text: "An Account may be registered and operated only by a person aged 13 or above. A Tutor or Tutor applicant must be aged 18 or above.",
      },
      {
        kind: "p",
        text: "A Minor aged 13\u201317 may register and operate only a Minor Account. A Minor Account may be used only for the limited, non-public and non-transactional functions made available by MatchMax.",
      },
      { kind: "p", text: "A Minor must not independently, through a Minor Account or otherwise:" },
      {
        kind: "ul",
        items: [
          "submit a tutoring enquiry;",
          "request or authorise an Introduction;",
          "communicate with a Tutor or Customer for the purpose of arranging tutoring;",
          "obtain a Tutor's non-public contact information;",
          "enter into, confirm or materially amend a Lesson Contract;",
          "accept responsibility for a Tuition Fee, Fee Agreement or other payment obligation;",
          "provide payment credentials; or",
          "submit a Tutor application.",
        ],
      },
      {
        kind: "p",
        text: "An Adult Customer may use their own Account or an Authorised MatchMax Channel to arrange tutoring for a Learner who is a Minor. The Adult Customer must select or approve the Tutor, approve the Tuition Fee and material lesson arrangements, enter into the Lesson Contract, ensure payment and provide appropriate safeguarding involvement.",
      },
      {
        kind: "p",
        text: "A person under 13 must not register or operate an Account, submit a Tutor application, independently arrange tutoring, accept a payment obligation or obtain a Tutor's non-public contact information.",
      },
      {
        kind: "p",
        text: "MatchMax may collect an age-eligibility declaration and use proportionate, risk-based measures to assess Account eligibility. MatchMax may request additional evidence or adult authorisation where required by applicable law, reasonably necessary to prevent circumvention of age restrictions, or necessary before enabling additional functions involving communications, Introductions, personal-data disclosure, locations or payments.",
      },
      {
        kind: "p",
        text: "MatchMax may impose a higher minimum age or additional Account restrictions where required by law applicable to a User or the provision of the Platform.",
      },
      {
        kind: "p",
        text: "MatchMax may restrict or close an Account where it reasonably believes that age information is inaccurate, an Account is being used to circumvent age restrictions or a Minor is attempting to access functions reserved for an Adult Customer or Tutor.",
      },
      {
        kind: "p",
        text: "Nothing prevents a Minor from contacting MatchMax directly to report a privacy, safety, safeguarding or Account-security concern.",
      },
      {
        kind: "p",
        text: "Users must protect their Account credentials, keep their contact details reasonably current and promptly report suspected unauthorised access. Accounts are personal and non-transferable.",
      },
    ],
  },
  {
    title: "4. MatchMax's role",
    blocks: [
      {
        kind: "p",
        text: "MatchMax operates a tutor-directory, matching, introduction, communication and related support platform. MatchMax may display Tutor profiles, receive and transmit enquiries, facilitate Introductions, record arrangements communicated through Authorised MatchMax Channels, provide administrative support and collect fees payable to MatchMax under an accepted Fee Agreement.",
      },
      {
        kind: "p",
        text: "MatchMax does not provide tutoring and is not a party to a Lesson Contract.",
      },
      {
        kind: "p",
        text: "Except where MatchMax expressly agrees otherwise in writing for a specific matter, MatchMax does not act as the Customer's or Tutor's agent and has no authority to enter into a Lesson Contract, agree lesson terms, make representations or incur obligations on either party's behalf.",
      },
      {
        kind: "p",
        text: "MatchMax does not guarantee that a Customer or Tutor will enter into or perform a Lesson Contract.",
      },
      {
        kind: "p",
        text: "Nothing in these Terms creates a partnership, joint venture, employment relationship, fiduciary relationship or general agency between MatchMax and a User.",
      },
    ],
  },
  {
    title: "5. Tutor independence",
    blocks: [
      { kind: "p", text: "Each Tutor:" },
      {
        kind: "ul",
        items: [
          "independently decides whether to accept a request;",
          "sets or approves their rate and availability;",
          "controls their ordinary teaching methods and materials;",
          "supplies their own ordinary equipment;",
          "bears their own expenses and business risk;",
          "may provide services through other lawful channels; and",
          "receives no guaranteed work from MatchMax.",
        ],
      },
      {
        kind: "p",
        text: "Tutors are responsible for determining and complying with their own applicable tax, business-registration, insurance, immigration, work-permission and professional requirements.",
      },
      { kind: "p", text: "A Tutor must not:" },
      {
        kind: "ul",
        items: [
          "represent themselves as a MatchMax employee;",
          "make commitments on MatchMax's behalf;",
          "allow another person to use their Tutor Account;",
          "use an unauthorised substitute;",
          "use Customer or Learner information for unrelated purposes; or",
          "transfer Customer information to another person without proper authority.",
        ],
      },
      {
        kind: "p",
        text: "Rejecting an unconfirmed tutoring request does not itself result in a fee or reliability penalty.",
      },
    ],
  },
  {
    title: "6. Communications and impersonation",
    blocks: [
      {
        kind: "p",
        text: "MatchMax may provide services through Authorised MatchMax Channels. An Introduction remains a MatchMax Introduction if subsequent communication occurs through an external messaging, telephone, email or social-media service.",
      },
      {
        kind: "p",
        text: "An Authorised MatchMax Representative may act only within the scope of their authority. Unless MatchMax confirms otherwise through an official company communication, a representative cannot amend these Terms, guarantee an outcome, promise compensation, waive an amount owed to MatchMax or bind MatchMax to a financial obligation.",
      },
      {
        kind: "p",
        text: "Users should verify unusual payment instructions, changes in payment details and requests for sensitive information through contact details published on MatchMax.hk. MatchMax will not request a User's password, one-time authentication code, complete card-security code, online-banking password or payment-wallet login credentials.",
      },
      {
        kind: "p",
        text: "A person is not authorised merely because they use MatchMax's name, branding or publicly available information. MatchMax is not responsible for unauthorised impersonation or communications outside its reasonable control, except to the extent that loss was caused by MatchMax's breach, negligence or failure to apply reasonable security measures.",
      },
      {
        kind: "p",
        text: "External communication services are operated under their providers' own terms and privacy practices. MatchMax does not guarantee their security or availability.",
      },
    ],
  },
  {
    title: "7. Tutor applications, verification, and profile evidence",
    blocks: [
      {
        kind: "p",
        text: "A Tutor applicant must provide genuine, complete and accurate information and evidence. By submitting information or evidence, the applicant represents that it is genuine, has not been falsified or deceptively altered and does not materially misrepresent the applicant's identity, qualifications, achievements or experience. Any permitted redaction must be clearly indicated, and the Tutor must promptly correct information that becomes inaccurate.",
      },
      {
        kind: "p",
        text: "Before approving a Tutor for listing, MatchMax reviews selected claims concerning the Tutor's academic qualifications, academic results, awards, achievements and relevant experience against documents or other evidence supplied by the Tutor. The scope of the review may differ according to the claims made and the evidence reasonably available.",
      },
      {
        kind: "p",
        text: "Profile information outside the selected claims reviewed by MatchMax may be self-reported and may not have been supported by documentary evidence. Completion of MatchMax's review does not mean that every statement in a Tutor profile has been independently authenticated.",
      },
      {
        kind: "p",
        text: "Unless MatchMax expressly states otherwise, MatchMax does not independently authenticate submitted evidence or confirm it with the issuing institution, employer, referee or other original source. False, altered, incomplete or misleading evidence may not always be detected.",
      },
      {
        kind: "p",
        text: "MatchMax lists only Tutors for whom it has completed the review described above. Describing a Tutor as \u201cverified\u201d means only that MatchMax completed that review using the evidence reasonably available at the time. It does not:",
      },
      {
        kind: "ul",
        items: [
          "guarantee that submitted evidence is genuine, accurate, complete or unaltered;",
          "confirm every statement in the Tutor's profile;",
          "constitute accreditation, endorsement or a recommendation by MatchMax;",
          "include any identity, criminal-record, employment-history, reference, immigration, work-permission, professional-registration or safeguarding check unless expressly stated; or",
          "guarantee teaching quality, suitability, compatibility, safety, availability, future conduct or academic results.",
        ],
      },
      {
        kind: "p",
        text: "MatchMax may request additional or updated evidence and may correct, restrict or remove a Tutor's listing where evidence is unavailable, outdated, disputed or reasonably suspected to be false, altered, incomplete or misleading.",
      },
      {
        kind: "p",
        text: "False, altered, incomplete or misleading information or evidence may result in application rejection, profile correction, suspension or termination. MatchMax may preserve and disclose relevant information where reasonably necessary to protect an affected person, investigate suspected fraud, exercise legal rights or comply with law.",
      },
    ],
  },
  {
    title: "8. AI-assisted document entry",
    blocks: [
      {
        kind: "p",
        text: "MatchMax may use an external AI or automated-processing service to extract or pre-fill information from documents submitted by Tutor applicants.",
      },
      {
        kind: "p",
        text: "AI output may be inaccurate or incomplete and does not verify the authenticity of a document or independently approve or reject an application. The Tutor must review extracted information, and MatchMax will conduct human review before publishing it or making an application decision based materially upon it.",
      },
    ],
  },
  {
    title: "9. Introductions and Lesson Contracts",
    blocks: [
      {
        kind: "p",
        text: "A Tutor listing, request, shortlist, suggestion or message is not by itself a confirmed lesson.",
      },
      {
        kind: "p",
        text: "A Minor Account cannot be used to request or authorise an Introduction or form a Lesson Contract. Saving or shortlisting a Tutor listing through a Minor Account does not constitute an enquiry, Introduction, lesson confirmation or agreement with that Tutor.",
      },
      {
        kind: "p",
        text: "Where the Learner is a Minor, only the Adult Customer and Tutor may agree the material tutoring arrangements and enter into or amend the Lesson Contract. A Minor's preference, message, attendance or other participation does not by itself form or amend a Lesson Contract.",
      },
      {
        kind: "p",
        text: "A Lesson Contract is formed directly between the Customer and Tutor if and when they communicate agreement to the material tutoring arrangements with an intention to be bound. MatchMax does not determine whether or when the parties have formed a Lesson Contract.",
      },
      {
        kind: "p",
        text: "The parties should ordinarily record the Tutor and Learner, subject, Tuition Fee, duration, date and time, lesson format, location where applicable, and agreed cancellation terms.",
      },
      {
        kind: "p",
        text: "The agreement may be recorded through an Authorised MatchMax Channel or another retrievable electronic communication. A separate checkbox is not required for every lesson, but the parties should retain evidence of their agreement.",
      },
      {
        kind: "p",
        text: "As conditions of continued use of the Platform, the Tutor and Customer agree to MatchMax that they will comply with the following standards in relation to a Lesson Contract. These standards do not make MatchMax a party to the Lesson Contract.",
      },
      { kind: "p", text: "The Tutor must:" },
      {
        kind: "ul",
        items: [
          "provide the agreed tutoring with reasonable care and skill;",
          "provide the agreed service and duration;",
          "maintain reasonably accurate profile information;",
          "comply with applicable safeguarding and academic-integrity requirements; and",
          "address reasonable concerns about their tutoring.",
        ],
      },
      { kind: "p", text: "The Customer must:" },
      {
        kind: "ul",
        items: [
          "provide accurate and proportionate learning requirements;",
          "provide a reasonably safe and appropriate lesson environment;",
          "ensure appropriate adult involvement where the Learner is a Minor;",
          "pay the agreed Tuition Fee; and",
          "treat the Tutor respectfully.",
        ],
      },
      {
        kind: "p",
        text: "MatchMax is not a party to the Lesson Contract and does not guarantee either party's performance.",
      },
    ],
  },
  {
    title: "10. MatchMax fees",
    blocks: [
      { kind: "p", text: "No fee is payable to MatchMax under these Terms alone." },
      {
        kind: "p",
        text: "A Minor cannot accept a Fee Agreement or become liable for a fee payable to MatchMax. Where a chargeable MatchMax service concerns a Learner who is a Minor, the relevant Fee Agreement must be separately accepted by the Adult Customer.",
      },
      {
        kind: "p",
        text: "Any fee payable to MatchMax must be stated in a separate written Fee Agreement presented and affirmatively accepted before the relevant chargeable service. The Fee Agreement forms part of the applicable Platform agreement and governs all fee-specific matters.",
      },
      {
        kind: "p",
        text: "Failure to pay an undisputed amount when due under an accepted Fee Agreement is a material breach. Subject to applicable law, MatchMax may suspend Platform services, restrict or terminate the relevant Account and pursue lawful recovery of the overdue amount.",
      },
      {
        kind: "p",
        text: "MatchMax will not impose or collect a fee prohibited by law or requiring a licence or authorisation that MatchMax does not hold.",
      },
    ],
  },
  {
    title: "11. Direct payment to Tutors",
    blocks: [
      {
        kind: "p",
        text: "Unless MatchMax expressly introduces a payment facility, the Customer and Tutor must agree a lawful direct payment method.",
      },
      { kind: "p", text: "MatchMax does not ordinarily:" },
      {
        kind: "ul",
        items: [
          "receive, hold or safeguard Tuition Fees;",
          "collect payment credentials;",
          "control the selected payment service;",
          "reverse an external payment; or",
          "guarantee payment or recovery of a refund.",
        ],
      },
      {
        kind: "p",
        text: "The Adult Customer remains responsible for ensuring payment. Payment may be made by another person acting with the Customer's authority where permitted by the payment provider. That payment does not make the payer the contracting Customer.",
      },
      {
        kind: "p",
        text: "The Tutor is responsible for confirming receipt and providing an appropriate payment acknowledgment.",
      },
    ],
  },
  {
    title: "12. Cancellations and refunds",
    blocks: [
      {
        kind: "p",
        text: "The Customer and Tutor are responsible for agreeing cancellation, rescheduling, lateness, no-show and refund terms before confirming a lesson.",
      },
      {
        kind: "p",
        text: "MatchMax is not a party to those arrangements, does not determine entitlement to refunds for direct payments and does not guarantee payment or recovery.",
      },
      {
        kind: "p",
        text: "MatchMax may consider documented cancellations, non-payment, no-shows or other conduct when deciding whether to restrict Platform access or provide further Introductions.",
      },
    ],
  },
  {
    title: "13. Safeguarding",
    blocks: [
      {
        kind: "p",
        text: "Users must maintain a safe, respectful and professional tutoring environment.",
      },
      { kind: "p", text: "Prohibited conduct includes:" },
      {
        kind: "ul",
        items: [
          "violence, abuse, grooming or exploitation;",
          "sexual or romantic conduct involving a Minor;",
          "sexualised or inappropriate communication;",
          "asking a Minor to conceal communications or events;",
          "using secret or disappearing-message functions to communicate with a Minor;",
          "unnecessary physical contact;",
          "photographing or recording a Minor without adult authorisation;",
          "publishing a Learner's information or lesson recording without authority;",
          "transporting a Minor without express adult permission;",
          "conducting a home lesson in a Minor's bedroom or similarly inappropriate private area;",
          "alcohol, illegal drugs or weapons during lessons;",
          "requesting passwords or financial credentials;",
          "harassment, threats or unlawful discrimination; and",
          "retaliation against a person reporting a concern.",
        ],
      },
      {
        kind: "p",
        text: "Home lessons involving a Minor should ordinarily take place in an appropriate common area. The Adult Customer must make supervision and safeguarding arrangements reasonably appropriate to the Learner's age and circumstances and remain reasonably contactable.",
      },
      {
        kind: "p",
        text: "MatchMax may restrict communications, pause an Introduction, cancel access, preserve relevant evidence or suspend an Account where reasonably necessary to address an urgent safeguarding or legal concern. MatchMax may disclose relevant information to an affected adult or competent authority where lawful and reasonably necessary.",
      },
      {
        kind: "p",
        text: "Nothing in these Terms prevents or restricts a lawful report to the Police, Social Welfare Department or another competent authority. Nothing in these Terms limits any reporting obligation under the Mandatory Reporting of Child Abuse Ordinance (Cap. 650). No User may wilfully inhibit or obstruct a report required by law, retaliate against a person for making a lawful report, or unlawfully disclose a reporter's identity.",
      },
    ],
  },
  {
    title: "14. Academic integrity",
    blocks: [
      { kind: "p", text: "Users must not request, provide or facilitate:" },
      {
        kind: "ul",
        items: [
          "examination impersonation;",
          "completion of assessed work on a Learner's behalf;",
          "plagiarism;",
          "falsification of academic results;",
          "unauthorised access to examination material;",
          "copyright infringement; or",
          "another unlawful educational service.",
        ],
      },
      {
        kind: "p",
        text: "Tutors may teach concepts, provide feedback, review drafts and demonstrate methods but must not submit work as if it were created by the Learner.",
      },
    ],
  },
  {
    title: "15. Acceptable use",
    blocks: [
      { kind: "p", text: "A User must not:" },
      {
        kind: "ul",
        items: [
          "use the Platform unlawfully or fraudulently;",
          "impersonate another person or MatchMax representative;",
          "interfere with Platform security;",
          "introduce malicious software;",
          "attempt unauthorised access;",
          "scrape or systematically copy Platform information without permission;",
          "harass another User;",
          "publish knowingly false or defamatory content;",
          "misuse personal information;",
          "interfere with or manipulate Platform records, verification processes, search results or matching processes;",
          "misstate a User's age, use another person's Account or otherwise circumvent an age-based Account restriction; or",
          "use MatchMax information for unsolicited or unrelated marketing.",
        ],
      },
    ],
  },
  {
    title: "16. Tutor profiles and content",
    blocks: [
      {
        kind: "p",
        text: "A User is responsible for content they submit and must have the right to provide it.",
      },
      { kind: "p", text: "Content must not:" },
      {
        kind: "ul",
        items: [
          "knowingly be false or misleading;",
          "infringe another person's rights;",
          "disclose unnecessary information about a Minor;",
          "contain unlawful, threatening or discriminatory material; or",
          "improperly manipulate search results, matching processes, verification records or other Platform information.",
        ],
      },
      {
        kind: "p",
        text: "A User retains ownership of their content but grants MatchMax a non-exclusive, royalty-free licence to host, store, format, reproduce and display it, and to permit MatchMax's service providers to do so on MatchMax's behalf, only as reasonably necessary to operate the Platform and relevant listing.",
      },
      {
        kind: "p",
        text: "MatchMax may investigate, correct, restrict or remove content where reasonably necessary for accuracy, privacy, safeguarding, legal compliance or Platform integrity.",
      },
      {
        kind: "p",
        text: "Except for User content, the Platform, software, design, databases, compilation, branding and materials made available by MatchMax are owned by or licensed to MatchMax. Subject to these Terms, MatchMax grants the User a limited, revocable, non-exclusive and non-transferable right to use the Platform for its intended purpose. No other right is granted.",
      },
      {
        kind: "p",
        text: "A Minor Account is private and is not a Tutor profile or public Learner profile. MatchMax will not publicly display information associated with a Minor Account merely because the Account is created or a Tutor listing is saved.",
      },
      {
        kind: "p",
        text: "Saving or shortlisting a Tutor listing does not authorise MatchMax to disclose the Minor's identity, contact information or Account information to that Tutor.",
      },
      {
        kind: "p",
        text: "Before publishing a new Tutor profile, MatchMax will identify the information proposed for publication and give the Tutor an opportunity to review and correct it. MatchMax will publish that information only after the Tutor authorises publication through an unticked-by-default checkbox or expressly confirms authorisation through an Authorised MatchMax Channel.",
      },
      {
        kind: "p",
        text: "MatchMax may make non-material formatting, layout and copy-editing changes that do not materially alter the meaning of the information authorised by the Tutor. MatchMax will obtain further authorisation before publishing materially new personal data that the Tutor has not previously authorised, unless the Tutor requested or expressly approved the relevant change.",
      },
    ],
  },
  {
    title: "17. Complaints and Platform decisions",
    blocks: [
      {
        kind: "p",
        text: "A User should report material non-performance, false information, payment disputes, impersonation or other significant concerns promptly. Safeguarding concerns should be reported immediately.",
      },
      {
        kind: "p",
        text: "MatchMax may request relevant communications, lesson details and appropriately redacted payment evidence. Except where urgent protective action is required, MatchMax may give the affected User a reasonable opportunity to respond.",
      },
      { kind: "p", text: "MatchMax may decide whether to:" },
      {
        kind: "ul",
        items: [
          "correct or remove Platform content;",
          "restrict or suspend an Account;",
          "record a reliability incident;",
          "offer discretionary rematching assistance; or",
          "take another proportionate Platform measure.",
        ],
      },
      {
        kind: "p",
        text: "MatchMax's administrative decision does not conclusively determine the parties' legal rights under their Lesson Contract.",
      },
      {
        kind: "p",
        text: "Payment and refund disputes concerning direct payments must ordinarily be resolved between the Customer and Tutor.",
      },
    ],
  },
  {
    title: "18. Suspension and termination",
    blocks: [
      {
        kind: "p",
        text: "MatchMax may warn, restrict, suspend or terminate an Account where it reasonably believes that the User:",
      },
      {
        kind: "ul",
        items: [
          "materially breached these Terms;",
          "provided false or misleading information;",
          "created a safety or security risk;",
          "engaged in fraud, impersonation, harassment or unlawful conduct;",
          "misused personal data;",
          "interfered with or manipulated Platform records, verification processes or matching processes;",
          "repeatedly failed to attend confirmed lessons;",
          "failed to pay an undisputed amount due under a separately accepted Fee Agreement; or",
          "exposed another User or MatchMax to material legal risk.",
        ],
      },
      {
        kind: "p",
        text: "MatchMax may take immediate temporary action in an urgent safeguarding, fraud, impersonation or security matter.",
      },
      {
        kind: "p",
        text: "MatchMax may, where reasonably practicable, lawful and appropriate, provide the User with a general reason and an opportunity to respond before or after the action.",
      },
      {
        kind: "p",
        text: "A User may close their Account, subject to outstanding obligations, confirmed arrangements, active disputes and records that MatchMax may lawfully retain.",
      },
      {
        kind: "p",
        text: "Termination does not affect rights or obligations accrued before termination.",
      },
      {
        kind: "p",
        text: "Provisions which by their nature are intended to continue after termination, including provisions concerning accrued fees, intellectual property, privacy, liability, indemnities and general contractual matters, will continue to apply.",
      },
    ],
  },
  {
    title: "19. Privacy",
    blocks: [
      {
        kind: "p",
        text: "MatchMax processes personal data according to its Privacy Policy and the Personal Information Collection Statement provided at the relevant collection point.",
      },
      {
        kind: "p",
        text: "Users must not provide another person's personal data unless they have proper authority and the information is reasonably necessary.",
      },
      {
        kind: "p",
        text: "Tutors may use Customer and Learner information only for the relevant enquiry, tutoring arrangement, payment, safeguarding and directly related purposes.",
      },
    ],
  },
  {
    title: "20. Platform and third-party availability",
    blocks: [
      {
        kind: "p",
        text: "MatchMax may maintain, modify, restrict or discontinue Platform functions, subject to any accepted Fee Agreement and applicable law. MatchMax does not guarantee uninterrupted, secure or error-free availability.",
      },
      {
        kind: "p",
        text: "Third-party authentication, messaging, social-media and payment services are independently operated. Their separate terms and privacy practices apply.",
      },
    ],
  },
  {
    title: "21. Disclaimers",
    blocks: [
      { kind: "p", text: "MatchMax does not guarantee:" },
      {
        kind: "ul",
        items: [
          "that a Tutor will accept a request;",
          "continuous Tutor availability;",
          "Tutor\u2013Learner compatibility;",
          "the authenticity, accuracy or completeness of information or evidence supplied by a Tutor;",
          "that MatchMax's review will detect every false, altered or misleading document or claim;",
          "that a Tutor approved for listing is suitable for a particular Customer or Learner, is free from risk or will continue to meet MatchMax's listing requirements;",
          "that safeguarding measures will identify every risk;",
          "uninterrupted Platform availability;",
          "any examination, admission, scholarship or academic outcome;",
          "availability of a replacement Tutor;",
          "recovery of an externally paid amount.",
        ],
      },
      {
        kind: "p",
        text: "MatchMax does not provide insurance, escrow, childcare, emergency, legal, tax, immigration or professional-licensing services.",
      },
    ],
  },
  {
    title: "22. Liability",
    blocks: [
      { kind: "p", text: "Nothing in these Terms excludes or limits liability for:" },
      {
        kind: "ul",
        items: [
          "fraud or fraudulent misrepresentation by MatchMax;",
          "death or personal injury caused by MatchMax's negligence;",
          "liability arising under the Supply of Services (Implied Terms) Ordinance that cannot lawfully be excluded or restricted against a person dealing as a consumer;",
          "a mandatory right or liability under applicable personal-data or consumer-protection legislation; or",
          "any other liability that cannot lawfully be excluded or limited.",
        ],
      },
      {
        kind: "p",
        text: "Subject to the above, and only to the extent that the relevant exclusion or limitation is fair, reasonable and legally enforceable:",
      },
      {
        kind: "ul",
        items: [
          "MatchMax is responsible only for direct and reasonably foreseeable loss caused by its breach of the applicable Platform agreement or negligence in operating the Platform;",
          "MatchMax is not responsible for a Tutor's or Customer's independent acts, omissions, tutoring, materials, conduct, cancellation, payment obligations or breach of a Lesson Contract, except to the extent that loss was caused by MatchMax's own breach or negligence;",
          "MatchMax is not responsible for loss caused by inaccurate or misleading information supplied by a User unless MatchMax knew of the issue and failed to respond reasonably;",
          "MatchMax is not responsible for loss caused by a User's failure to protect Account credentials, follow reasonable security warnings or verify unusual communications or payment instructions;",
          "MatchMax is not responsible for impersonation, external communication or payment services, or events outside its reasonable control, except to the extent that loss was caused by MatchMax's own breach or negligence;",
          "MatchMax is not liable for indirect or consequential loss;",
          "where a User acts in the course of a business, MatchMax is not liable for loss of profit, revenue, anticipated earnings, business, contracts, opportunity, savings, goodwill or reputation; and",
          "MatchMax's total aggregate liability to a claimant arising from one event or a series of connected events will not exceed the greater of:",
          "HK$10,000; and",
          "the total fees actually paid by that claimant to MatchMax under accepted Fee Agreements during the 12 months immediately preceding the event giving rise to the claim.",
        ],
      },
      {
        kind: "p",
        text: "Tuition Fees paid to a Tutor are not fees paid to MatchMax and are not included when calculating this limit.",
      },
      {
        kind: "p",
        text: "Each exclusion and limitation applies separately and only to the maximum extent permitted by law.",
      },
      {
        kind: "p",
        text: "A claimant must take reasonable steps to avoid or reduce their loss and may not recover more than once for the same loss.",
      },
    ],
  },
  {
    title: "23. Indemnities",
    blocks: [
      {
        kind: "p",
        text: "To the extent reasonable and permitted by law, a Tutor will indemnify MatchMax against third-party claims and reasonable costs directly caused by the Tutor's:",
      },
      {
        kind: "ul",
        items: [
          "fraud, negligence or unlawful tutoring conduct;",
          "knowingly false or unauthorised profile content;",
          "safeguarding misconduct;",
          "intellectual-property infringement;",
          "unauthorised substitution;",
          "misuse of personal data; or",
          "breach of applicable tax, immigration, business or professional obligations.",
        ],
      },
      {
        kind: "p",
        text: "A Customer will indemnify MatchMax only against third-party claims directly caused by the Customer's fraudulent or unlawful use of the Platform.",
      },
      { kind: "p", text: "No indemnity:" },
      {
        kind: "ul",
        items: [
          "applies to a Minor;",
          "covers loss caused by MatchMax; or",
          "requires payment of an amount that is disproportionate or legally unrecoverable.",
        ],
      },
    ],
  },
  {
    title: "24. Changes to these Terms",
    blocks: [
      {
        kind: "p",
        text: "MatchMax may update these Terms prospectively for legal, security, operational or service changes.",
      },
      {
        kind: "p",
        text: "Material changes will be notified appropriately before taking effect. A change will not retrospectively alter an existing Lesson Contract or accrued obligation unless required by law or accepted by the affected parties.",
      },
      {
        kind: "p",
        text: "MatchMax may require renewed acceptance before a User continues using functions materially affected by updated Terms.",
      },
    ],
  },
  {
    title: "25. General provisions",
    blocks: [
      {
        kind: "p",
        text: "These Terms and any Tutor Terms or Fee Agreement separately accepted by the relevant User constitute the agreement between that User and MatchMax concerning the Platform.",
      },
      { kind: "p", text: "If there is an inconsistency:" },
      {
        kind: "ul",
        items: [
          "a Fee Agreement governs only fee-specific matters;",
          "Tutor Terms govern only Tutor-specific Platform matters; and",
          "these Terms govern all other Platform matters.",
        ],
      },
      {
        kind: "p",
        text: "A Match Confirmation is evidence only of the transaction details that it accurately records. It does not make MatchMax a party to the Lesson Contract or create a term not agreed by the Customer and Tutor.",
      },
      {
        kind: "p",
        text: "A separate document does not bind a User unless it was made reasonably available and affirmatively accepted before the relevant obligation arose.",
      },
      {
        kind: "p",
        text: "If a provision is unlawful or unenforceable, it will be treated as modified to the minimum extent necessary to make it enforceable, if permitted by law; otherwise, it will be severed. The remaining provisions will continue.",
      },
      { kind: "p", text: "Failure to enforce a provision immediately is not a waiver." },
      {
        kind: "p",
        text: "A User may not transfer their Account or Platform agreement without MatchMax's consent. MatchMax may transfer its agreement as part of a genuine business sale or restructuring, subject to applicable law.",
      },
      {
        kind: "p",
        text: "An Authorised MatchMax Representative has no authority to vary these Terms except where MatchMax expressly confirms the variation through an official company communication.",
      },
      {
        kind: "p",
        text: "A person who is not a party to the relevant agreement has no right under the Contracts (Rights of Third Parties) Ordinance to enforce any provision of that agreement.",
      },
      {
        kind: "p",
        text: "No action taken through a Minor Account binds an adult, forms or amends a Lesson Contract, accepts a Fee Agreement or creates a payment obligation.",
      },
      {
        kind: "p",
        text: "These Terms and the agreement between MatchMax and the relevant User are governed by Hong Kong law. The Hong Kong courts have jurisdiction, subject to any mandatory right that applies.",
      },
    ],
  },
  {
    title: "26. Contact",
    blocks: [
      { kind: "p", text: "Questions, complaints and legal notices should be sent to:" },
      {
        kind: "p",
        text: "Hau Yui Chan, trading as MatchMax\nShop T163, 3/F, The Capital, 61-65 Chatham Road South, Tsim Sha Tsui, Kowloon, Hong Kong\ncontact@matchmax.hk",
      },
    ],
  },
];

function TermsOfUsePage() {
  return (
    <PublicPage>
      <PageIntro
        description="The ground rules for using MatchMax — what you can expect from us and what we expect from you."
        eyebrow="Legal"
        meta="Effective 8 September 2026"
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
                        {block.items?.map((item, itemIndex) => (
                          <li key={itemIndex} className="pl-1">
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p key={index} className="whitespace-pre-wrap">
                        {block.text}
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
