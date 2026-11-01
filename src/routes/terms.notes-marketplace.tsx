import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * #573 Part 3 names /terms/notes-marketplace as the address of the Notes
 * Marketplace Terms. The page itself stays at /legal/notes-terms (already
 * linked from the upload gate, checkout and ToS); this path redirects there.
 */
export const Route = createFileRoute("/terms/notes-marketplace")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/legal/notes-terms", search, replace: true });
  },
});
