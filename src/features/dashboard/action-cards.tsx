import type { ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  ClipboardList,
  Compass,
  MessageSquareHeart,
  Search,
  GraduationCap,
} from "lucide-react";

import {
  SuggestedActionCard,
  SuggestedActionGrid,
  type SuggestedActionTagColor,
} from "./suggested-actions";

type CardSpec = {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  tagKey: string;
  tagColor: SuggestedActionTagColor;
  headlineKey: string;
  descriptionKey: string;
  primaryTo?: string;
  primaryLabelKey: string;
  /** Appends `{ post: true }` to the primary link (case-posting entry). */
  primaryPost?: boolean;
  /** Explicit search params for the primary link (e.g. Help audience tab). */
  primarySearch?: Record<string, unknown>;
  secondaryTo?: string;
  secondaryLabelKey?: string;
  /** data-tour anchor for the coach-mark tours (issue #397). */
  tourId?: string;
};

/** Tutor dashboard cards (issue #147 content spec). */
const TUTOR_ACTION_CARDS: CardSpec[] = [
  {
    icon: BadgeCheck,
    tagKey: "dashboard.actions.tag_profile_upgrade",
    tagColor: "blue",
    headlineKey: "dashboard.actions.tutor_verify_headline",
    descriptionKey: "dashboard.actions.tutor_verify_desc",
    primaryTo: "/tutors",
    primaryLabelKey: "dashboard.actions.tutor_verify_primary",
    secondaryTo: "/guide",
    secondaryLabelKey: "dashboard.actions.tutor_verify_secondary",
    tourId: "tutor-verification",
  },
  {
    icon: ClipboardList,
    tagKey: "dashboard.actions.tag_quick_link",
    tagColor: "gray",
    headlineKey: "dashboard.actions.tutor_cases_headline",
    descriptionKey: "dashboard.actions.tutor_cases_desc",
    primaryTo: "/tutor-requests",
    primaryLabelKey: "dashboard.actions.tutor_cases_primary",
    secondaryTo: "/tutor-requests",
    secondaryLabelKey: "dashboard.actions.tutor_cases_secondary",
    tourId: "tutor-cases",
  },
  {
    icon: Compass,
    tagKey: "dashboard.actions.tag_tutor_guide",
    tagColor: "gray",
    headlineKey: "dashboard.actions.tutor_guide_headline",
    descriptionKey: "dashboard.actions.tutor_guide_desc",
    primaryTo: "/help",
    primarySearch: { audience: "tutors" },
    primaryLabelKey: "dashboard.actions.tutor_guide_primary",
    secondaryTo: "/help",
    secondaryLabelKey: "dashboard.actions.secondary_help_center",
  },
  {
    icon: MessageSquareHeart,
    tagKey: "dashboard.actions.tag_feedback",
    tagColor: "gray",
    headlineKey: "dashboard.actions.feedback_headline",
    descriptionKey: "dashboard.actions.tutor_feedback_desc",
    primaryTo: "/feedback",
    primaryLabelKey: "dashboard.actions.feedback_primary",
  },
];

/** Parent & student dashboard cards (issue #147 content spec). */
const PARENT_ACTION_CARDS: CardSpec[] = [
  {
    icon: ClipboardList,
    tagKey: "dashboard.actions.tag_get_started",
    tagColor: "green",
    headlineKey: "dashboard.actions.parent_case_headline",
    descriptionKey: "dashboard.actions.parent_case_desc",
    primaryTo: "/tutor-requests",
    primaryPost: true,
    primaryLabelKey: "dashboard.actions.parent_case_primary",
    secondaryTo: "/help",
    secondaryLabelKey: "dashboard.actions.parent_case_secondary",
  },
  {
    icon: Search,
    tagKey: "dashboard.actions.tag_quick_link",
    tagColor: "gray",
    headlineKey: "dashboard.actions.parent_browse_headline",
    descriptionKey: "dashboard.actions.parent_browse_desc",
    primaryTo: "/tutors",
    primaryLabelKey: "dashboard.actions.parent_browse_primary",
    secondaryTo: "/tutors",
    secondaryLabelKey: "dashboard.actions.parent_browse_secondary",
  },
  {
    icon: GraduationCap,
    tagKey: "dashboard.actions.tag_parent_guide",
    tagColor: "gray",
    headlineKey: "dashboard.actions.parent_guide_headline",
    descriptionKey: "dashboard.actions.parent_guide_desc",
    primaryTo: "/guide",
    primaryLabelKey: "dashboard.actions.parent_guide_primary",
    secondaryTo: "/help",
    secondaryLabelKey: "dashboard.actions.secondary_help_center",
  },
  {
    icon: MessageSquareHeart,
    tagKey: "dashboard.actions.tag_feedback",
    tagColor: "gray",
    headlineKey: "dashboard.actions.feedback_headline",
    descriptionKey: "dashboard.actions.parent_feedback_desc",
    primaryTo: "/feedback",
    primaryLabelKey: "dashboard.actions.feedback_primary",
  },
];

/**
 * Issue #147: "Suggested Actions" section. Content switches on account type —
 * tutors get verification/case-board/guide cards, parents get case-posting
 * and discovery cards. Rendered above the settings sections.
 */
export function SuggestedActionsSection({ isTutor }: { isTutor: boolean }) {
  const { t } = useTranslation();
  const cards = isTutor ? TUTOR_ACTION_CARDS : PARENT_ACTION_CARDS;
  return (
    <section aria-labelledby="suggested-actions-title" className="space-y-4">
      <h2
        id="suggested-actions-title"
        className="text-lg font-bold tracking-tight text-[color:var(--ink)]"
      >
        {t("dashboard.actions.title")}
      </h2>
      <SuggestedActionGrid>
        {cards.map((card) => (
          <SuggestedActionCard
            key={card.headlineKey}
            icon={card.icon}
            tagKey={card.tagKey}
            tagColor={card.tagColor}
            headlineKey={card.headlineKey}
            descriptionKey={card.descriptionKey}
            primaryTo={card.primaryTo}
            primaryLabelKey={card.primaryLabelKey}
            primarySearch={card.primarySearch ?? (card.primaryPost ? { post: true } : undefined)}
            secondaryTo={card.secondaryTo}
            secondaryLabelKey={card.secondaryLabelKey}
            dataTour={card.tourId}
          />
        ))}
      </SuggestedActionGrid>
    </section>
  );
}
