import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicPage } from "@/components/layout/PublicPage";
import { useAuth } from "@/features/auth/useAuth";
import { canonicalUrl, currentSeoLocale, localeLinks, localizedMeta } from "@/features/i18n/seo";
import { JoinChooser } from "@/features/tutor-application/join-chooser";
import { ApplicationForm } from "@/features/tutor-application/ApplicationForm";
import { supabase } from "@/integrations/supabase/client";
import { REFERRAL_CODE_PATTERN, storeReferralCode } from "@/lib/referral";
import { stripPendingCompleteParam } from "@/lib/pending-submit";

const joinSearch = z.object({
  path: z.enum(["tutor"]).optional().catch(undefined),
  ref: z.string().optional().catch(undefined),
  // #759 Part 1 (was #732): the end-of-flow Google OAuth callback lands back
  // here so the guest's tutor intake auto-commits after sign-in. The marker
  // rides as "1" (urlWithPendingComplete), so coerce rather than z.boolean().
  complete_pending_submit: z
    .preprocess(
      (value) => (value === true || value === "1" || value === "true" ? true : undefined),
      z.boolean(),
    )
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute("/join")({
  validateSearch: joinSearch,
  head: () => ({
    meta: [
      ...localizedMeta(currentSeoLocale(), {
        title: {
          en: "Join MatchMax | Become a Tutor",
          "zh-HK": "加入 MatchMax | 成為導師、賣筆記或者合作",
          "zh-CN": "加入 MatchMax | 成为导师、出售笔记或合作",
        },
        description: {
          en: "Fill one complete tutor intake — matching data, grades, bio and availability — publish your card, sell study notes, or partner with MatchMax as a tutoring centre in Hong Kong.",
          "zh-HK":
            "一份導師資料就搞掂：配對資料、成績、自我介紹同時間表，發佈導師卡、賣學習筆記，或者以補習中心身份同 MatchMax 合作。",
          "zh-CN":
            "填写一份完整的导师资料：匹配数据、成绩、自我介绍和可上课时间，发布导师卡片、出售学习笔记，或以培训机构身份与 MatchMax 合作。",
        },
      }),
      { name: "robots", content: "index, follow" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonicalUrl("/join") },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: localeLinks("/join"),
  }),
  component: JoinPage,
});

/**
 * #576 role chooser; #718 restores the full single-page tutor intake
 * (ApplicationForm) as the Tutor path — one submission collects the core
 * matching data, availability and status fields, deferring only credential
 * verification to the existing post-submit flow.
 *
 * #759 Part 1 (was #732): this page is now PUBLIC — guests open and fill the
 * whole intake with zero login wall, and Google OAuth runs only when they
 * click Submit (the matchmax_pending_submission_v1 handoff). Signed-in
 * tutors submit directly. An existing tutor adding roles from the chooser
 * still lands on their Channel Profile editor.
 */
function JoinPage() {
  const { t } = useTranslation();
  const { path, ref, complete_pending_submit: completePending } = Route.useSearch();
  // Referral links land here; the code travels with the eventual activation.
  useEffect(() => {
    const code = ref?.trim();
    if (code && REFERRAL_CODE_PATTERN.test(code)) storeReferralCode(code);
  }, [ref]);
  // The completion marker only matters for the first hydration pass; strip
  // it afterwards so a refresh never re-triggers the auto-submit.
  useEffect(() => {
    if (completePending) stripPendingCompleteParam();
  }, [completePending]);
  const tutorPath = path === "tutor";

  // An existing tutor adds roles from the chooser, but never re-activates a card.
  const { user } = useAuth();
  const navigate = useNavigate();
  const owned = useQuery({
    queryKey: ["join", "owned-card", user?.id],
    enabled: Boolean(user) && tutorPath,
    queryFn: async () => {
      const [card, profile] = await Promise.all([
        supabase.from("tutors").select("id, is_published").eq("user_id", user!.id).maybeSingle(),
        supabase.from("profiles").select("handle").eq("id", user!.id).maybeSingle(),
      ]);
      const handle = profile.data?.handle ?? null;
      // #759 P0: the channel page resolves profiles case-insensitively while
      // some legacy rows store mixed-case handles, so a blind redirect can
      // land on "Channel not found". Verify the channel exists (and use the
      // stored spelling) before redirecting — otherwise stay on the form.
      let channelHandle: string | null = null;
      if (handle) {
        const { data: channel } = await supabase
          .from("profiles")
          .select("handle")
          .ilike("handle", handle)
          .maybeSingle();
        channelHandle = channel?.handle ?? null;
      }
      return {
        hasCard: Boolean(card.data),
        // A published card is the only state where the channel page is the
        // right destination. An unpublished one is a tutor mid-onboarding, and
        // bouncing them to a page that may not resolve is exactly the dead end
        // that stopped tutors entering their data.
        isPublished: card.data?.is_published === true,
        channelHandle,
      };
    },
  });
  useEffect(() => {
    const channelHandle = owned.data?.channelHandle;
    if (!owned.data?.hasCard || !owned.data?.isPublished || !channelHandle) return;
    void navigate({
      to: "/u/$handle",
      params: { handle: channelHandle },
      search: { edit: "open" },
      replace: true,
    });
  }, [owned.data, navigate]);

  return (
    <PublicPage>
      <PageIntro
        description={t(tutorPath ? "join_flow.intake_desc" : "join_flow.chooser_desc")}
        title={t(tutorPath ? "join_flow.intake_title" : "join_flow.chooser_title")}
        width="wide"
        dense
        meta={t("join.new_to_market")}
      />
      <PageContainer className="py-5 sm:py-6" width="wide">
        {tutorPath ? (
          <ApplicationForm completePending={completePending === true} />
        ) : (
          <JoinChooser />
        )}
      </PageContainer>
    </PublicPage>
  );
}
