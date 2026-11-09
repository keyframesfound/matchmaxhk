import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicPage } from "@/components/layout/PublicPage";
import { useAuth } from "@/features/auth/useAuth";
import { canonicalUrl, localeLinks } from "@/features/i18n/seo";
import { JoinChooser } from "@/features/tutor-application/join-chooser";
import { ApplicationForm } from "@/features/tutor-application/ApplicationForm";
import { supabase } from "@/integrations/supabase/client";
import { REFERRAL_CODE_PATTERN, storeReferralCode } from "@/lib/referral";

const joinSearch = z.object({
  path: z.enum(["tutor"]).optional().catch(undefined),
  ref: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/_authenticated/join")({
  validateSearch: joinSearch,
  head: () => ({
    meta: [
      { title: "Join MatchMax - Become a Tutor" },
      {
        name: "description",
        content:
          "Fill one complete tutor intake — matching data, grades, bio and availability — publish your card, sell study notes, or partner with MatchMax as a tutoring centre in Hong Kong.",
      },
      { property: "og:title", content: "Join MatchMax" },
      {
        property: "og:description",
        content:
          "Fill one complete tutor intake — matching data, grades, bio and availability — publish your card, sell study notes, or partner with MatchMax as a tutoring centre in Hong Kong.",
      },
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
 */
function JoinPage() {
  const { t } = useTranslation();
  const { path, ref } = Route.useSearch();
  // Referral links land here; the code travels with the eventual activation.
  useEffect(() => {
    const code = ref?.trim();
    if (code && REFERRAL_CODE_PATTERN.test(code)) storeReferralCode(code);
  }, [ref]);
  const tutorPath = path === "tutor";

  // An existing tutor adds roles from the chooser, but never re-activates a card.
  const { user } = useAuth();
  const navigate = useNavigate();
  const owned = useQuery({
    queryKey: ["join", "owned-card", user?.id],
    enabled: Boolean(user) && tutorPath,
    queryFn: async () => {
      const [card, profile] = await Promise.all([
        supabase.from("tutors").select("id").eq("user_id", user!.id).maybeSingle(),
        supabase.from("profiles").select("handle").eq("id", user!.id).maybeSingle(),
      ]);
      return { hasCard: Boolean(card.data), handle: profile.data?.handle ?? null };
    },
  });
  useEffect(() => {
    if (!owned.data?.hasCard || !owned.data.handle) return;
    void navigate({
      to: "/u/$handle",
      params: { handle: owned.data.handle },
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
        {tutorPath ? <ApplicationForm /> : <JoinChooser />}
      </PageContainer>
    </PublicPage>
  );
}
