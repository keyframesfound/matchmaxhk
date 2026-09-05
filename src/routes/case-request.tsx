import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/case-request")({
  beforeLoad: () => {
    throw redirect({ to: "/tutor-requests", search: { post: true }, replace: true });
  },
});
