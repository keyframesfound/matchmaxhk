import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/business/team")({
  beforeLoad: () => {
    throw redirect({ to: "/business", search: { tab: "team" } });
  },
});
