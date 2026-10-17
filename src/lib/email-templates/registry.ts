import type { ComponentType } from "react";

import { AccountStatusEmail } from "./account-status";
import { ConciergeUnpaidDigestEmail } from "./concierge-unpaid-digest";
import { FeeReminderEmail } from "./fee-reminder";
import { OrderDeliveredEmail } from "./order-delivered";
import { TutorCardLiveEmail } from "./tutor-card-live";

export interface TemplateEntry {
  component: ComponentType<Record<string, unknown>>;
  subject: string | ((data: Record<string, unknown>) => string);
  displayName?: string;
  previewData?: Record<string, unknown>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  // Add templates here as they are created, e.g.:
  // 'welcome': welcomeTemplate,

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
      `Admin fee reminder${data?.case_code ? ` — case ${String(data.case_code)}` : ""}`,
  },
  "order-delivered": {
    component: OrderDeliveredEmail as unknown as ComponentType<Record<string, unknown>>,
    subject: (data: Record<string, unknown>) =>
      data?.variant === "tutor" ? "Your note sold" : "Your MatchMax order is delivered",
  },
  "concierge-unpaid-digest": {
    component: ConciergeUnpaidDigestEmail as unknown as ComponentType<Record<string, unknown>>,
    subject: (data: Record<string, unknown>) =>
      `${Number(data?.count ?? 0)} unpaid admin fee(s) past due`,
  },
};
