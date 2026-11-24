import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * `/account/cases` layout. The cases list lives in
 * `_authenticated.account.cases.index.tsx`; this file renders the case detail
 * child (`/account/cases/$caseId`). Without an `<Outlet />` here the detail
 * page would never mount — the same bug this pair fixes for `/account`.
 */
export const Route = createFileRoute("/_authenticated/account/cases")({
  head: () => ({
    meta: [
      { title: "My cases | MatchMax" },
      { name: "description", content: "Your MatchMax cases." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: () => <Outlet />,
});
