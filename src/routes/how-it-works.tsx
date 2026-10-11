import { createFileRoute, redirect } from "@tanstack/react-router";

// Issue #208: the old one-page explainer is replaced by the guide hub.
// All /how-it-works traffic lands on /guide.
export const Route = createFileRoute("/how-it-works")({
  beforeLoad: () => {
    throw redirect({ to: "/guide" });
  },
});
