import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * #783 §2.2: /cookies was a 404. The cookie notice and the change-your-choice
 * panel live in Privacy → Cookies, so this path redirects there.
 */
export const Route = createFileRoute("/cookies")({
  beforeLoad: () => {
    throw redirect({ to: "/privacy-policy", hash: "cookies", replace: true });
  },
});
