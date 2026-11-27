import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { canonicalUrl, currentSeoLocale, localeLinks, localizedMeta } from "@/features/i18n/seo";
export const Route = createFileRoute("/become-a-tutor")({
  head: () => ({
    meta: [
      ...localizedMeta(currentSeoLocale(), {
        title: {
          en: "Become a Tutor in Hong Kong | MatchMax",
          "zh-HK": "成為香港導師 | MatchMax",
          "zh-CN": "成为香港导师 | MatchMax",
        },
        description: {
          en: "Apply to join MatchMax as a tutor in Hong Kong.",
          "zh-HK": "申請成為 MatchMax 香港導師，建立導師檔案，設定科目及收費，讓家長輕鬆找到你。",
          "zh-CN": "申请成为 MatchMax 香港导师，建立导师档案，设置科目和收费，让家长找到你。",
        },
      }),
      { name: "robots", content: "index, follow" },
      { property: "og:url", content: canonicalUrl("/become-a-tutor") },
    ],
    links: localeLinks("/become-a-tutor"),
  }),
  component: BecomeATutorRedirect,
});

function BecomeATutorRedirect() {
  const navigate = useNavigate({ from: "/become-a-tutor" });
  useEffect(() => {
    navigate({ to: "/join", replace: true });
  }, [navigate]);
  return null;
}
