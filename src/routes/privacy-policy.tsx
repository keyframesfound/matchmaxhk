import { createFileRoute } from "@tanstack/react-router";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicPage } from "@/components/layout/PublicPage";
import { localeLinks } from "@/features/i18n/seo";
import { CookieSettingsPanel } from "@/components/layout/CookieConsentBanner";
import { useTranslation } from "react-i18next";
import { LegalZhSummary, type ZhLegalItem } from "@/features/legal/legal-zh-summary";

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
    links: localeLinks("/privacy-policy"),
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
          "banks and payment providers handling MatchMax fees, including Stripe for card, Apple Pay, AlipayHK and WeChat Pay payments;",
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
      {
        kind: "p",
        text: "**Essential only (default).** On your first visit we ask you to choose. Until you do, and if you choose Essential only, we keep only what the site needs to work: your sign-in session, language and display-currency preferences, and on-device drafts and saved searches. Tutor profile views and enquiry clicks are counted with a temporary random key that is erased when the browser tab closes.",
      },
      {
        kind: "p",
        text: "**Accept all.** If you choose Accept all, that random key is kept on your device so repeat visits are counted once. It is not linked to your account, name, IP address or device details. We do not use advertising or cross-site tracking cookies. You can change your choice at any time below.",
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
  {
    title: "12. Study materials (notes) orders",
    blocks: [
      {
        kind: "p",
        text: "When a buyer purchases a tutor’s study materials through MatchMax, we process a narrow order record: the buyer account, the pack identifier, the payment reference, and the download time. We do not use order data for unrelated purposes. Card payments are processed by Stripe, which receives the payment credentials directly; MatchMax stores only the order record and the Stripe payment reference, never card numbers.",
      },
      {
        kind: "ul",
        items: [
          "Each delivered file is stamped with the order reference and a masked form of the buyer’s email address (for example j***@g***.com) so leaks can be traced.",
          "Every download is logged with the order, account, file, IP address, browser and time, to prove delivery in disputes.",
          "The selling tutor sees units sold and net amounts owed. The tutor does not see the buyer’s name, phone number, or email.",
          "Staff may view a file to review it before release or to handle a complaint.",
          "Order records are kept for seven years. On request, we delete a delivered file where there is no outstanding payout or dispute relating to it.",
        ],
      },
      {
        kind: "p",
        text: "The commercial terms for notes, licences, refunds, and takedowns, are set out in the Notes Terms (/legal/notes-terms).",
      },
    ],
  },
  {
    title: "12A. Notes sellers, moderation and retention",
    blocks: [
      {
        kind: "p",
        text: "When you register as a notes seller we collect your payout details (FPS, PayMe or AlipayHK), the account holder name, and your age and authority declaration with its time and IP address. We use them only to pay you, keep accounts and prevent fraud.",
      },
      {
        kind: "ul",
        items: [
          "Order, payout, fee and dispute ledgers: kept for 7 years from the transaction date, as section 51C of the Inland Revenue Ordinance (Cap. 112) requires.",
          "Moderation logs, reports and removed listings: kept for 2 years from resolution for legal defence and repeat-offender tracking, then permanently deleted in line with the Personal Data (Privacy) Ordinance (Cap. 486).",
          "Uploaded listings, file text and preview images are checked automatically, including by an AI content review run by a third-party AI provider, for banned material (such as copied official exam papers or textbooks), contact details and violent or sexual content; unclear uploads are reviewed by staff.",
        ],
      },
    ],
  },
  {
    title: "13. Matching cases and the admin fee",
    blocks: [
      {
        kind: "p",
        text: "When you submit a case request, we record the case details, the submitting account, and your matching-fee agreement (version, account, and time). If a match is made, the case also holds the payer name, the fee amount, the FPS payment reference, and the time the fee was marked paid.",
      },
      {
        kind: "ul",
        items: [
          "The tutor on a case never sees the payer’s phone number. The payer does not see the tutor’s phone number until the introduction rules allow it (after the admin fee is settled).",
          "Centre contact details and the student’s full name are visible to MatchMax staff only.",
          "MatchMax staff see the case details only to introduce the match and collect the fee.",
          "We do not sell the case list.",
          "A delete request hides the profile. An unpaid or disputed fee is kept until the case is closed.",
          "Fee records are kept for seven years.",
        ],
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

/**
 * #783 AC-COOKIE-2: 繁中 summary for the Chinese route. English is the binding
 * text and the summary says so; it covers every heading plus the clauses with
 * data, retention, cookies and notes-order consequences.
 */
const ZH_SUMMARY: readonly ZhLegalItem[] = [
  {
    heading: "1. 適用範圍與收集通知",
    body: "本政策說明 MatchMax 如何收集、使用、披露及保留你的個人資料，適用於平台的所有使用者，包括家長、學員及導師。",
  },
  {
    heading: "2. 我們收集的個人資料",
    body: "包括帳戶資料（姓名、電郵、電話、語言）、導師的學歷與認證文件、個案與課堂紀錄、筆記訂單資料，以及技術資料（IP、裝置與瀏覽器資訊、使用紀錄）。",
  },
  {
    heading: "3. 收集目的",
    body: "用於配對與介紹、處理個案與收費、交付教材、安全保障與防止濫用、客戶支援，以及按你已同意的範圍發送推廣訊息。",
  },
  {
    heading: "4. 未成年人",
    body: "未滿 18 歲學員的資料由家長或監護人提供及管理。我們只收集提供服務所需的資料，並限制公開範圍。",
  },
  {
    heading: "5. 公開導師檔案",
    body: "導師的姓名、科目、學歷及收費等資料會公開展示，用於配對。你可選擇不公開部分資料，但可能影響配對機會。",
  },
  {
    heading: "6. 資料披露",
    body: "我們只向提供服務所需的第三方披露資料，例如儲存、電郵、付款（包括 Stripe 處理信用卡、Apple Pay、支付寶香港及微信支付）、身分及安全服務供應商，以及法律要求的機構。",
  },
  {
    heading: "7. 外部處理、人工智能與安全",
    body: "部分服務由外部供應商處理，並受其條款約束。我們會以加密、存取控制及審計紀錄保護資料。提示你切勿提交密碼或卡片安全碼。",
  },
  {
    heading: "8. Cookies",
    body: "我們使用 cookies 及類似技術維持登入、保安及偏好設定。首次到訪時可選擇「全部接受」或「僅必要 cookies」，並可隨時在私隱政策此段更改選擇。",
  },
  {
    heading: "9. 保留與刪除",
    body: "我們只保留提供服務、處理爭議及符合法律要求所需的時間。收費紀錄一般保留七年。你亦可要求刪除帳戶及相關資料。",
  },
  {
    heading: "10. 查閱、更正與私隱要求",
    body: "你有權查閱及更正個人資料，並可提出刪除或限制處理的要求。我們會按香港《個人資料（私隱）條例》處理，並於合理時間內回覆。",
  },
  {
    heading: "11. 政策變更",
    body: "我們可能更新本政策；重大變更會於生效前通知，並更新頁面上方的版本日期。",
  },
  {
    heading: "12. 學習材料（筆記）訂單",
    body: "購買筆記時，我們只處理狹窄的訂單紀錄：買家帳戶、教材編號、付款參考及下載時間。交付的檔案會加入訂單編號及遮蔽後的買家電郵，每次下載均會記錄，用於爭議時證明交付。信用卡由 Stripe 直接處理，我們不儲存卡號。",
  },
  {
    heading: "12A. 筆記賣家、審核與保留",
    body: "賣家的收款資料只供內部使用，不會公開展示。上載內容會經自動及人手審核，違規內容可被移除。",
  },
  {
    heading: "13. 配對個案與行政費",
    body: "提交個案時，我們會記錄個案內容、提交帳戶及你的收費同意紀錄（版本、帳戶及時間）。配對成功後，個案亦會保存付款人姓名、費用金額、轉數快付款參考及標記為已付款的時間。職員僅為介紹配對及收取費用而查閱個案資料；我們不會出售個案名單。刪除要求會隱藏個人檔案，未繳付或爭議中的費用則保留至個案結束。",
  },
];

const ZH_NOTICE =
  "以下為中文摘要，方便理解。本政策以英文原文為準；如中英文版本有任何歧義，概以英文版本為依據。";

function PrivacyPolicyPage() {
  const { i18n } = useTranslation();
  const showZhSummary = Boolean(i18n.language?.startsWith("zh"));
  return (
    <PublicPage>
      <PageIntro
        description="Your privacy matters to us. This policy explains how MatchMax collects and handles your personal data."
        meta="Current as of 15 September 2026"
        title="Privacy Policy"
      />

      <section className="py-14 sm:py-20">
        <PageContainer width="narrow">
          <div className="space-y-12">
            {showZhSummary ? (
              <LegalZhSummary items={ZH_SUMMARY} notice={ZH_NOTICE} title="中文摘要" />
            ) : null}

            <div className="border-b border-border pb-12 text-base leading-7 text-muted-foreground">
              <p className="whitespace-pre-wrap">{INTRO_TEXT}</p>
            </div>

            {SECTIONS.map((section) => (
              <article
                key={section.title}
                id={section.title.startsWith("8.") ? "cookies" : undefined}
                className="scroll-mt-24 border-b border-border pb-12 last:border-b-0 last:pb-0"
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
                  {/* #783 §2.2: change the cookie choice (EN + 繁中). */}
                  {section.title.startsWith("8.") ? <CookieSettingsPanel /> : null}
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
