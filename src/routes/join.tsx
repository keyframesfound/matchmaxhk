import { createFileRoute } from "@tanstack/react-router";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageIntro } from "@/components/layout/PageIntro";
import { PublicPage } from "@/components/layout/PublicPage";
import { ApplicationForm } from "@/features/tutor-application/ApplicationForm";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Apply to tutor with MatchMax - Tutor Application" },
      {
        name: "description",
        content:
          "Apply to join the MatchMax tutor team in Hong Kong. Share your academic results, experience and availability.",
      },
      { property: "og:title", content: "Apply to tutor with MatchMax" },
      { property: "og:description", content: "Join the MatchMax tutor network in Hong Kong." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://matchmax.hk/join" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/join" }],
  }),
  component: JoinPage,
});

function JoinPage() {
  return (
    <PublicPage>
      <PageIntro
        description="Build your teaching profile for the exam systems and subjects you know best."
        title="Apply to Tutor With MatchMax"
        width="wide"
      />
      <PageContainer className="py-8 sm:py-12" width="wide">
        <ApplicationForm />
      </PageContainer>
    </PublicPage>
  );
}
