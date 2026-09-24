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

type Block =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "table"; columns: [string, string]; rows: { scenario: string; resolution: string }[] };

const INTRO_TEXT = `MatchMax Platform Terms of Service
Effective date: September 24, 2026
Operator: Hau Yui Chan, trading as MatchMax
Business Registration number: 41690777
Registered address: Shop T163, 3/F, The Capital, 61-65 Chatham Road South, Tsim Sha Tsui, Kowloon, Hong Kong
Email: contact@matchmax.hk

These Terms govern MatchMax.hk and MatchMax's digital introductory platform and concierge matching services.`;

const SECTIONS: { title: string; blocks: Block[] }[] = [
  {
    title: "1. Nature of the Service",
    blocks: [
      {
        kind: "p",
        text: "MatchMax operates exclusively as a **digital introductory platform and concierge matching service**. MatchMax is not an employment agency, an employer, or an educational institution. All tutors utilizing the platform are strictly **independent contractors**. MatchMax does not control, direct, or supervise the tutors' pedagogical methods, lesson locations, or schedules.",
      },
    ],
  },
  {
    title: "2. Fee Structure and Payments",
    blocks: [
      {
        kind: "p",
        text: "MatchMax charges an **Administrative Matching Fee** directly to the Client (the parent/student) for the service of sourcing, verifying, and connecting them with a tutor.",
      },
      {
        kind: "ul",
        items: [
          "This fee is equivalent to 1.5 times the agreed-upon hourly rate of the tutor (covering the initial matching phase and first 2 lessons).",
          "This fee is payable by the Client directly to MatchMax via FPS within 24 hours following the successful completion of the first trial lesson.",
          "**Non-Refundable Administrative Fee:** MatchMax provides an introductory matching service. Once a trial lesson has been successfully completed, the Administrative Matching Fee is strictly non-refundable. MatchMax does not guarantee the longevity of any tutoring arrangement.",
          "**Early Terminations:** If a Client or Tutor terminates the arrangement after the initial lesson(s), MatchMax is not liable to issue refunds, partial refunds, or guaranteed payouts to either party. MatchMax evaluates early terminations strictly for internal quality control and platform safety.",
          "**Short-Term Case Exemption:** In the event that the Client explicitly requests a finite, short-term tutoring arrangement—strictly defined as five (5) scheduled lessons or fewer—the standard 1.5-lesson Administrative Matching Fee shall be waived. In its place, MatchMax will charge an adjusted fee equal to twenty percent (20%) of the total gross value of the scheduled lessons. This Short-Term Fee is payable by the Client to MatchMax via FPS within 24 hours of the completion of the first trial lesson. Any attempt to artificially declare a case “short-term” to bypass the standard fee, followed by continued direct lessons, constitutes a violation of the non-circumvention clause.",
          "**Late Payments & Default:** If the Client fails to remit the Administrative Matching Fee within the stipulated timeframe, MatchMax reserves the right to suspend the match, advise the Tutor to halt future lessons, and restrict the Client from future use of the platform.",
          "MatchMax does not extract commissions or deductions from the independent contractor's (tutor's) ongoing wages. Following the initial 1.5-lesson introductory fee, all financial transactions occur directly between the Client and the Tutor.",
        ],
      },
    ],
  },
  {
    title: "3. Non-Circumvention (Bypassing)",
    blocks: [
      {
        kind: "p",
        text: "By utilizing MatchMax to connect with a tutor or client, both parties agree not to bypass the platform to avoid the initial Administrative Matching Fee. If MatchMax determines that a parent and tutor have colluded to schedule private lessons prior to the payment of the MatchMax fee, both parties will be **permanently banned** from the network, and the Client agrees to a liquidated damages penalty of **HK$2,000** for breach of contract.",
      },
      {
        kind: "p",
        text: "**Anti-Collusion & Non-Circumvention:** Any attempt by a Client and Tutor to falsely declare an “Early Termination” to evade standard platform fees, while continuing to conduct lessons privately, constitutes a material breach of this agreement. Such actions will result in an immediate platform ban for the Tutor and the activation of the HK$2,000 Liquidated Damages penalty against the Client.",
      },
    ],
  },
  {
    title: "4. Dispute and Cancellation Matrix",
    blocks: [
      {
        kind: "p",
        text: "While MatchMax is not a party to the direct contract between the Client and Tutor, we enforce the following guidelines regarding the initial matched lessons:",
      },
      {
        kind: "table",
        columns: ["Scenario", "Platform Resolution"],
        rows: [
          {
            scenario: "Tutor No-Show (Trial Lesson)",
            resolution:
              "Client owes no platform fee and receives a priority free rematch. The Tutor's profile will incur a permanent reliability strike or removal.",
          },
          {
            scenario: "Client Cancels < 6 Hours Prior",
            resolution:
              "Client forfeits the right to cancel the trial lesson at no charge. MatchMax may invoice the Client for a portion of the fee to compensate the Tutor for reserved calendar time.",
          },
          {
            scenario: "Tutor Cancels Last Minute",
            resolution:
              "Client receives a free reschedule. Repeated occurrences by the Tutor will result in platform de-listing.",
          },
          {
            scenario: "Unsatisfactory Trial Lesson",
            resolution:
              "Client pays the Tutor directly for the logged time. MatchMax enacts the First-Lesson Free Rematch Guarantee, waiving the subsequent platform fee to source a replacement.",
          },
        ],
      },
      {
        kind: "p",
        text: "**Dispute Adjudication:** For any disputes arising during the initial MatchMax fee period, MatchMax relies exclusively on the timestamped communication within the dedicated MatchMax WhatsApp group to determine arrival times, cancellations, and performance. MatchMax's internal decision regarding the waiver or enforcement of the Administrative Matching Fee is final.",
      },
    ],
  },
  {
    title: "5. User Reviews and Platform Feedback",
    blocks: [
      {
        kind: "p",
        text: "MatchMax periodically requests optional feedback from Clients regarding their matched Tutors. By submitting a review and checking the permission box, the Client grants MatchMax a non-exclusive, royalty-free license to display, reproduce, and publicly feature the submitted comments and the Client's first name on the MatchMax website and associated marketing channels. Tutors acknowledge that MatchMax retains the right, at its sole discretion, to publish positive testimonials or internally log negative feedback, which may affect the Tutor's future visibility or standing on the platform.",
      },
    ],
  },
  {
    title: "6. Limitation of Liability",
    blocks: [
      {
        kind: "p",
        text: "Upon completion of the first 1.5 lessons and collection of the Administrative Matching Fee, MatchMax relinquishes all involvement in the scheduling, payment, and execution of the educational services. MatchMax is not legally or financially liable for tutor or student no-shows, unpaid wages, physical injury, property damage, or failure to achieve specific academic outcomes.",
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
        meta="Effective 24 September 2026"
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
                  {section.blocks.map((block, index) => {
                    if (block.kind === "ul") {
                      return (
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
                      );
                    }
                    if (block.kind === "table") {
                      return (
                        <div key={index} className="overflow-x-auto">
                          <table className="w-full border-collapse text-left text-sm">
                            <thead>
                              <tr className="border-b border-border">
                                {block.columns.map((column) => (
                                  <th
                                    key={column}
                                    scope="col"
                                    className="py-3 pr-6 font-semibold text-foreground"
                                  >
                                    {column}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {block.rows.map((row) => (
                                <tr
                                  key={row.scenario}
                                  className="border-b border-border align-top last:border-b-0"
                                >
                                  <th
                                    scope="row"
                                    className="py-4 pr-6 text-left font-semibold text-foreground"
                                  >
                                    {row.scenario}
                                  </th>
                                  <td className="py-4 leading-7">{renderInline(row.resolution)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    }
                    return (
                      <p key={index} className="whitespace-pre-wrap">
                        {renderInline(block.text)}
                      </p>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </PageContainer>
      </section>
    </PublicPage>
  );
}
