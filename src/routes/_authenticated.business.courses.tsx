import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/business/courses")({
  beforeLoad: () => {
    throw redirect({ to: "/business", search: { tab: "courses" } });
  },
});
