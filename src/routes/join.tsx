import { createFileRoute } from "@tanstack/react-router";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
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
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-black text-[color:var(--ink)] sm:text-4xl">
              Apply to tutor with MatchMax
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Build your teaching profile for the exam systems and subjects you know best.
            </p>
          </div>
          <div className="mt-8">
            <ApplicationForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}