import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/case-request")({
  beforeLoad: ({ search }) => {
    // #768: forward a tapped Open grid cell's time pre-fill (req_time) through
    // the redirect so /case-request?req_time=... behaves like the direct link.
    const params = (search ?? {}) as Record<string, unknown>;
    const reqTime = typeof params.req_time === "string" ? params.req_time : undefined;
    throw redirect({
      to: "/tutor-requests",
      search: { post: true, ...(reqTime ? { req_time: reqTime } : {}) },
      replace: true,
    });
  },
});
