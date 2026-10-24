import { createFileRoute } from "@tanstack/react-router";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { GroupClassesBoard } from "@/features/cases/group-classes-board";

export const Route = createFileRoute("/group-classes")({
  head: () => ({
    meta: [
      { title: "Small Group Classes (2–6 students) | MatchMax" },
      {
        name: "description",
        content:
          "Join a tutor-led small group class in Hong Kong — 2 to 6 students at a lower per-student rate. The same 1.5-lesson admin fee applies per student; every family keeps a private 1-on-1 case.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Small Group Classes | MatchMax" },
      {
        property: "og:description",
        content:
          "Browse open group cohorts — 2 to 6 students, lower per-student rates, the same per-student 1.5-lesson admin fee.",
      },
      { property: "og:url", content: "https://matchmax.hk/group-classes" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/group-classes" }],
  }),
  component: GroupClassesPage,
});

/** Issue #391: the public small-group cohorts board. */
function GroupClassesPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <GroupClassesBoard />
      </main>
      <SiteFooter />
    </div>
  );
}
