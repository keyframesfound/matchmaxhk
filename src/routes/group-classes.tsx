import { createFileRoute } from "@tanstack/react-router";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { currentSeoLocale, localizedMeta } from "@/features/i18n/seo";
import { GroupClassesBoard } from "@/features/cases/group-classes-board";

export const Route = createFileRoute("/group-classes")({
  head: () => {
    const locale = currentSeoLocale();
    return {
      meta: [
        ...localizedMeta(locale, {
          title: {
            en: "Small Group Classes (2–6 students) | MatchMax",
            "zh-HK": "小組班（2至6人）| MatchMax",
          },
          description: {
            en: "Join a tutor-led small group class in Hong Kong — 2 to 6 students at a lower per-student rate. The same 1.5-lesson admin fee applies per student; every family keeps a private 1-on-1 case.",
            "zh-HK":
              "參加由導師開辦嘅香港小組班——2至6人，每位學生費率更低。同一個 1.5 課管理費按每位學生計，每個家庭都有自己嘅私人一對一個案。",
          },
        }),
        { name: "robots", content: "index, follow" },
        {
          property: "og:description",
          content:
            locale === "zh-HK"
              ? "瀏覽開放招生嘅小組班——2至6人、每位學生費率更低、同一個按每位學生計嘅 1.5 課管理費。"
              : "Browse open group cohorts — 2 to 6 students, lower per-student rates, the same per-student 1.5-lesson admin fee.",
        },
        { property: "og:url", content: "https://matchmax.hk/group-classes" },
      ],
      links: [{ rel: "canonical", href: "https://matchmax.hk/group-classes" }],
    };
  },
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
