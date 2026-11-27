import { createFileRoute } from "@tanstack/react-router";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import {
  canonicalUrl,
  currentSeoLocale,
  localeLinks,
  localizedMeta,
  pickCopy,
} from "@/features/i18n/seo";
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
            "zh-CN": "小组课（2至6人）| MatchMax",
          },
          description: {
            en: "Join a tutor-led small group class in Hong Kong, 2 to 6 students at a lower per-student rate. The same 1.5-lesson admin fee applies per student; every family keeps a private 1-on-1 case.",
            "zh-HK":
              "參加由導師開辦的香港小組班：2 至 6 人，每位學生收費更低。1.5 堂行政費按每位學生計算，每個家庭均有獨立的一對一個案。",
            "zh-CN":
              "参加由导师开办的香港小组课——2至6人，每位学生的费用更低。同样的 1.5 节课行政费按每位学生计算，每个家庭都有自己的私人一对一个案。",
          },
        }),
        { name: "robots", content: "index, follow" },
        {
          property: "og:description",
          content: pickCopy(
            {
              en: "Browse open group cohorts, 2 to 6 students, lower per-student rates, the same per-student 1.5-lesson admin fee.",
              "zh-HK":
                "瀏覽開放招生的小組班：2 至 6 人，每位學生收費更低，1.5 堂行政費按每位學生計算。",
              "zh-CN":
                "浏览开放招生的小组课——2至6人、每位学生费率更低、同一个按每位学生计的 1.5 节课行政费。",
            },
            locale,
          ),
        },
        { property: "og:url", content: canonicalUrl("/group-classes") },
      ],
      links: localeLinks("/group-classes"),
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
