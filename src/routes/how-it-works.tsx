import { createFileRoute, redirect } from "@tanstack/react-router";

// Issue #208: the old one-page explainer is replaced by the guide hub.
// Blocker 4 of the AI review: old bookmark anchors must survive the move —
// the referral-bounty section now lives at /guide/refer, everything else
// maps onto the hub (whose FAQ section keeps the id "faq").
const HASH_TARGETS: Record<string, string> = {
  "referral-bounty": "/guide/refer",
  faq: "/guide",
};

export const Route = createFileRoute("/how-it-works")({
  beforeLoad: ({ search }) => {
    // NavigateOptions carries the hash top-level (not inside search); the
    // SPA hash-scroll in GuidePage picks it up after the redirect lands.
    const hash = ((search as { hash?: string } | undefined)?.hash ?? "").replace(/^#/, "");
    const target = HASH_TARGETS[hash] ?? "/guide";
    throw redirect({ to: target, hash: hash || undefined });
  },
});
