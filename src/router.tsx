import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { PageSkeleton } from "./components/layout/PageSkeleton";
import {
  getActiveUrlLocale,
  localeOfSegment,
  parseLocalePath,
  segmentOfLocale,
  setActiveUrlLocale,
  type LocaleSegment,
} from "@/features/i18n/routing";

export const getRouter = () => {
  const queryClient = new QueryClient();

  // The URL locale lives in a per-router-instance closure: on the server a
  // fresh router is built per request, so rendered link hrefs can never leak
  // one request's locale into another's HTML. The module-level mirror
  // (setActiveUrlLocale) only feeds head() meta helpers, which run in the
  // same request pipeline.
  let urlSegment: LocaleSegment = segmentOfLocale(getActiveUrlLocale());

  const rewrite = {
    // /zh/tutors → /tutors before route matching, recording the locale.
    input: ({ url }: { url: URL }) => {
      const parsed = parseLocalePath(url.pathname);
      if (parsed) {
        urlSegment = parsed.segment;
        setActiveUrlLocale(localeOfSegment(parsed.segment));
        url.pathname = parsed.rest;
      }
      return url;
    },
    // Internal /tutors → /zh/tutors for every href the router emits.
    output: ({ url }: { url: URL }) => {
      url.pathname =
        url.pathname === "/" || url.pathname === ""
          ? `/${urlSegment}`
          : `/${urlSegment}${url.pathname.startsWith("/") ? url.pathname : `/${url.pathname}`}`;
      return url;
    },
  };

  const router = createRouter({
    routeTree,
    context: { queryClient },
    rewrite,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: PageSkeleton,
  });

  return router;
};
