/**
 * Edge HTML cache for public locale pages (2026-11-09).
 *
 * Every SSR render costs Worker CPU; on the Free plan concurrent crawls of
 * tutor profiles hit the limit and Cloudflare answered 503 (error 1102).
 * SSR output here is anonymous (auth lives client-side), so a public page is
 * the same for every visitor and safe to share from the Workers Cache API:
 * fresh for FRESH_SECONDS, then served stale while a background render
 * refreshes it, up to STALE_SECONDS. The build id is part of the key, so a
 * deploy never serves HTML that points at deleted asset hashes.
 */

import { parseLocalePath } from "@/features/i18n/routing";

export const FRESH_SECONDS = 5 * 60;
export const STALE_SECONDS = 60 * 60;

const CACHED_AT_HEADER = "x-mm-cached-at";
const ORIGIN_CACHE_CONTROL_HEADER = "x-mm-origin-cache-control";
const CACHE_STATUS_HEADER = "x-mm-cache";
const BUILD_PARAM = "__mm_build";

// Logged-in app areas: their SSR is an anonymous shell anyway, but nothing
// is gained by caching them and keeping them out avoids surprises.
const PRIVATE_PREFIXES = [
  "/admin",
  "/dashboard",
  "/auth",
  "/account",
  "/my-cases",
  "/post-case",
  "/notifications",
  "/calendar",
  "/activity",
  "/saved-posts",
  "/orders",
  "/me",
  "/business",
];

export interface EdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

type CacheStatus = "HIT" | "STALE" | "MISS";

export function isCacheablePageRequest(request: Request): boolean {
  if (request.method !== "GET") return false;
  const parsed = parseLocalePath(new URL(request.url).pathname);
  if (!parsed) return false;
  const { rest } = parsed;
  if (rest.slice(rest.lastIndexOf("/") + 1).includes(".")) return false;
  return !PRIVATE_PREFIXES.some((prefix) => rest === prefix || rest.startsWith(`${prefix}/`));
}

function isCacheableResponse(response: Response): boolean {
  if (response.status !== 200) return false;
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return false;
  if (response.headers.has("set-cookie")) return false;
  return !/no-store|private/i.test(response.headers.get("cache-control") ?? "");
}

function cacheKey(request: Request, buildId: string): Request {
  const url = new URL(request.url);
  url.searchParams.set(BUILD_PARAM, buildId);
  return new Request(url.toString(), { method: "GET" });
}

/** Copy for the cache: stamped with its age and a lifetime the store honours. */
function toStored(response: Response, nowMs: number): Response {
  const headers = new Headers(response.headers);
  const originCacheControl = headers.get("cache-control");
  if (originCacheControl) headers.set(ORIGIN_CACHE_CONTROL_HEADER, originCacheControl);
  headers.set(CACHED_AT_HEADER, String(nowMs));
  headers.set("cache-control", `public, max-age=${STALE_SECONDS}`);
  return new Response(response.body, { status: response.status, headers });
}

/** Strip the internal stamps so browsers see the page's own caching headers. */
function toServed(stored: Response, status: CacheStatus): Response {
  const headers = new Headers(stored.headers);
  const originCacheControl = headers.get(ORIGIN_CACHE_CONTROL_HEADER);
  headers.delete(ORIGIN_CACHE_CONTROL_HEADER);
  headers.delete(CACHED_AT_HEADER);
  if (originCacheControl) headers.set("cache-control", originCacheControl);
  else headers.delete("cache-control");
  headers.set(CACHE_STATUS_HEADER, status);
  return new Response(stored.body, { status: stored.status, headers });
}

function logCacheError(error: unknown): void {
  console.error("[edge-html-cache]", error);
}

/** Render, and when the result is shareable, start writing a copy to the cache. */
async function renderAndStore(
  render: () => Promise<Response>,
  cache: EdgeCache,
  key: Request,
  nowMs: number,
): Promise<{ response: Response; stored: Promise<void> | null }> {
  const response = await render();
  if (!isCacheableResponse(response)) return { response, stored: null };
  const stored = cache.put(key, toStored(response.clone(), nowMs)).catch(logCacheError);
  return { response, stored };
}

export async function serveWithEdgeCache(options: {
  request: Request;
  cache: EdgeCache;
  buildId: string;
  render: () => Promise<Response>;
  waitUntil: (promise: Promise<unknown>) => void;
  now?: () => number;
}): Promise<Response> {
  const { request, cache, buildId, render, waitUntil, now = Date.now } = options;
  if (!isCacheablePageRequest(request)) return render();

  const key = cacheKey(request, buildId);
  let cached: Response | undefined;
  try {
    cached = await cache.match(key);
  } catch (error) {
    logCacheError(error);
  }

  if (cached) {
    const ageMs = now() - Number(cached.headers.get(CACHED_AT_HEADER) ?? 0);
    if (ageMs <= FRESH_SECONDS * 1000) return toServed(cached, "HIT");
    if (ageMs <= STALE_SECONDS * 1000) {
      waitUntil(
        renderAndStore(render, cache, key, now())
          .then(({ stored }) => stored)
          .catch(logCacheError),
      );
      return toServed(cached, "STALE");
    }
  }

  const { response, stored } = await renderAndStore(render, cache, key, now());
  if (stored) waitUntil(stored);
  const headers = new Headers(response.headers);
  headers.set(CACHE_STATUS_HEADER, "MISS");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
