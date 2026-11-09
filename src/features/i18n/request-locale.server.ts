/**
 * Per-request URL locale for SSR (2026-11-09 SEO fix).
 *
 * Workers serve many requests from one isolate, so the module-scoped locale
 * in routing.ts is shared across concurrent renders: while request A awaited
 * its loaders, request B's rewrite could flip the locale and A's head() then
 * emitted B's canonical. AsyncLocalStorage (nodejs_compat) gives every
 * request its own value, derived from its URL before rendering starts.
 */

import { AsyncLocalStorage } from "node:async_hooks";

import { localeOfSegment, parseLocalePath, setRequestLocaleResolver } from "./routing";
import type { SeoLocale } from "./seo";

const requestLocale = new AsyncLocalStorage<SeoLocale | null>();

setRequestLocaleResolver(() => requestLocale.getStore());

/**
 * Run `fn` with the locale of `request`'s URL pinned for its whole async
 * lifetime. Unprefixed requests (server fns, sitemap, assets) store null and
 * fall back to the router-set module value.
 */
export function runWithRequestLocale<T>(request: Request, fn: () => T): T {
  const parsed = parseLocalePath(new URL(request.url).pathname);
  return requestLocale.run(parsed ? localeOfSegment(parsed.segment) : null, fn);
}
