import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { canonicalUrl, hreflangLinks } from "@/features/i18n/seo";
export const Route = createFileRoute("/become-a-tutor")({
  head: () => ({
    meta: [
      { title: "Become a Tutor in Hong Kong | MatchMax" },
      { name: "description", content: "Apply to join MatchMax as a tutor in Hong Kong." },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "Become a Tutor in Hong Kong | MatchMax" },
      { property: "og:description", content: "Apply to join MatchMax as a tutor in Hong Kong." },
      { property: "og:url", content: canonicalUrl("/become-a-tutor") },
    ],
    links: [
      { rel: "canonical", href: canonicalUrl("/become-a-tutor") },
      ...hreflangLinks("/become-a-tutor"),
    ],
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
