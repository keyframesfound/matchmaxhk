import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * `/account` layout. The dashboard itself lives in `_authenticated.account.index.tsx`;
 * this file exists only to render its children, because a route that has child
 * routes must render an `<Outlet />` or the child never mounts. Every account
 * page brings its own SiteHeader/SiteFooter, so the layout stays bare — adding
 * chrome here would double it.
 */
export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Account | MatchMax" },
      { name: "description", content: "Your MatchMax account." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: () => <Outlet />,
});
