import type { ComponentType } from "react";

import { AccountStatusEmail } from "./account-status";
import { ActionRequiredEmail } from "./action-required";
import { CentreEnquiryEmail } from "./centre-enquiry";
import { ConciergeUnpaidDigestEmail } from "./concierge-unpaid-digest";
import { FeeReceiptEmail } from "./fee-receipt";
import { FeeReminderEmail } from "./fee-reminder";
import { LessonUpdateEmail } from "./lesson-update";
import { OrderDeliveredEmail } from "./order-delivered";
import { TutorCardLiveEmail } from "./tutor-card-live";
import { TutorSuggestionsEmail } from "./tutor-suggestions";
import { WeeklyDigestEmail } from "./weekly-digest";

export interface TemplateEntry {
  component: ComponentType<Record<string, unknown>>;
  subject: string | ((data: Record<string, unknown>) => string);
  displayName?: string;
  previewData?: Record<string, unknown>;
  /** Fixed recipient, overrides caller-provided recipientEmail when set. */
  to?: string;
}

/**
 * Template registry, maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  // Add templates here as they are created, e.g.:
  // 'welcome': welcomeTemplate,

  // #717 / #783 §2.3: "3 tutors with open slots" (automated marketing:
  // opt-in, 7-day cap, same-subject suppression, one-click unsubscribe).
  "tutor-suggestions": {
    component: TutorSuggestionsEmail as unknown as ComponentType<Record<string, unknown>>,
    subject: (data: Record<string, unknown>) =>
      data?.locale === "zh-HK"
        ? `3 位符合 ${String(data?.subjectLabel ?? "")} 並尚有名額的獨立導師 | MatchMax`
        : `3 tutors for ${String(data?.subjectLabel ?? "")} with open slots this month | MatchMax`,
  },

  // Issue #308: one email per account status change (suspend / ban /
  // restore). Content is the status line + community-commitment pointer.
  "account-status": {
    component: AccountStatusEmail as unknown as ComponentType<Record<string, unknown>>,
    subject: "Your MatchMax account status changed",
  },

  // Issue #310: sent to the applicant right after /join publishes their card.
  "tutor-card-live": {
    component: TutorCardLiveEmail as unknown as ComponentType<Record<string, unknown>>,
    subject: "Your MatchMax tutor card is live",
  },

  // Issue #205: bus emails. Data comes from case_events payloads via the
  // drain; the concierge digest lists the same rows as the admin unpaid queue.
  "fee-reminder": {
    component: FeeReminderEmail as unknown as ComponentType<Record<string, unknown>>,
    subject: (data: Record<string, unknown>) =>
      `Admin fee reminder${data?.case_code ? `, case ${String(data.case_code)}` : ""}`,
  },
  // #259: one receipt per paid admin fee (case id, amount, paid time).
  "fee-receipt": {
    component: FeeReceiptEmail as unknown as ComponentType<Record<string, unknown>>,
    subject: (data: Record<string, unknown>) =>
      `Payment received${data?.caseCode ? `, case ${String(data.caseCode)}` : ""}`,
  },
  "order-delivered": {
    component: OrderDeliveredEmail as unknown as ComponentType<Record<string, unknown>>,
    subject: (data: Record<string, unknown>) =>
      data?.variant === "tutor"
        ? "Material sold, funds in the 72-hour protection hold"
        : "Your MatchMax order is delivered",
  },
  "concierge-unpaid-digest": {
    component: ConciergeUnpaidDigestEmail as unknown as ComponentType<Record<string, unknown>>,
    subject: (data: Record<string, unknown>) =>
      `${Number(data?.count ?? 0)} unpaid admin fee(s) past due`,
  },
  // #461 addendum Triggers 8-9: one template, four lifecycle variants; the
  // emitting server fn owns heading/body/lessonLine in the payload.
  "lesson-update": {
    component: LessonUpdateEmail as unknown as ComponentType<Record<string, unknown>>,
    subject: (data: Record<string, unknown>) =>
      `${String(data?.heading ?? "Lesson update")}${
        data?.caseCode ? `, case ${String(data.caseCode)}` : ""
      }`,
  },
  // #542 triggers + #561 Action Required: one flexible template; the copy
  // module (features/cases/action-email.server.ts) builds heading/body/CTA
  // in the recipient's locale and deliverOne passes them as templateData.
  "action-required": {
    component: ActionRequiredEmail as unknown as ComponentType<Record<string, unknown>>,
    subject: (data: Record<string, unknown>) => String(data?.heading ?? "MatchMax action needed"),
  },
  // #796 §2.6 (AC-742-4): weekly learning digest. The Sunday task builds the
  // per-case line arrays in both locales; automated_marketing in email-policy
  // so the 7-day cap and the unsubscribe link apply.
  "weekly-digest": {
    component: WeeklyDigestEmail as unknown as ComponentType<Record<string, unknown>>,
    subject: "Weekly Learning Digest / 每週學習進度週報",
    previewData: {
      sections: [
        {
          caseCode: "MX-1042",
          url: "https://matchmax.hk/cases/00000000-0000-4000-8000-000000000000",
          en: [
            "Lesson with the tutor on quadratic factorisation: 2 of 3 practice sets completed independently.",
            "Tutor assessment: steadier progress choosing the method before substituting.",
          ],
          zh: [
            "與導師的二次式因式分解課堂：3 組練習中獨立完成 2 組。",
            "導師評語：在代入前先選對方法方面穩定進步。",
          ],
        },
      ],
    },
  },
  // #815 §2.5: a public course enquiry notifies the centre admins. An
  // enquiry only, never a paid enrolment, so no payment wording appears.
  "centre-enquiry": {
    component: CentreEnquiryEmail as unknown as ComponentType<Record<string, unknown>>,
    subject: (data: Record<string, unknown>) =>
      `New enquiry: ${String((data as { courseTitle?: unknown }).courseTitle ?? "Partner Centre course")}`,
  },
};
