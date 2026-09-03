import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/business/settings")({
  beforeLoad: () => {
    throw redirect({ to: "/business", search: { tab: "profile" } });
  },
});
