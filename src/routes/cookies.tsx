import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * #783 §2.2: /cookies was a 404. The cookie notice and the change-your-choice
 * panel live in Privacy → Cookies, so this path redirects there.
 */
export const Route = createFileRoute("/cookies")({
  beforeLoad: () => {
    // 301, not the default 307: /cookies is retired for good, so search
    // equity moves to the privacy policy's Cookies section.
    throw redirect({ to: "/privacy-policy", hash: "cookies", replace: true, statusCode: 301 });
  },
});
