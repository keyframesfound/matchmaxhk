import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

// Issue #564: the #527 Help Centre redesign wired legacy redirects for
// /tutor-playbook and /help/tutor-guide/tutor-handbook but left the older
// indexed two-segment paths as 404 dead ends: /help/tutor-guide (the old
// handbook category home) and /help/tutor-handbook. Both were tutor-audience
// pages, so they join the playbook leg on the tutor Help tab. Any other
// /help/$category path has never been a page — keep the 404.
const LEGACY_HELP_CATEGORY_REDIRECTS = new Set(["tutor-guide", "tutor-handbook"]);

export const Route = createFileRoute("/help/$category/")({
  beforeLoad: ({ params }) => {
    if (LEGACY_HELP_CATEGORY_REDIRECTS.has(params.category)) {
      throw redirect({ to: "/help", search: { audience: "tutors" }, statusCode: 301 });
    }
    throw notFound();
  },
});
