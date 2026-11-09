import { describe, expect, it, vi } from "vitest";

import {
  FRESH_SECONDS,
  STALE_SECONDS,
  isCacheablePageRequest,
  serveWithEdgeCache,
  type EdgeCache,
} from "../src/lib/edge-html-cache";

function memoryCache(): EdgeCache & { store: Map<string, Response> } {
  const store = new Map<string, Response>();
  return {
    store,
    async match(request) {
      return store.get(request.url)?.clone();
    },
    async put(request, response) {
      store.set(request.url, response);
    },
  };
}

function html(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    ...init,
    headers: { "content-type": "text/html; charset=utf-8", ...(init.headers ?? {}) },
  });
}

function setup(path: string, buildId = "b1") {
  const pending: Promise<unknown>[] = [];
  return {
    request: new Request(`https://matchmax.hk${path}`),
    waitUntil: (p: Promise<unknown>) => void pending.push(p),
    flush: () => Promise.all(pending.splice(0)),
    buildId,
  };
}

describe("isCacheablePageRequest", () => {
  it("accepts public locale pages", () => {
    for (const path of ["/en", "/zh/tutors", "/cn/tutors/MM-T001", "/en/help/a/b?x=1"]) {
      expect(isCacheablePageRequest(new Request(`https://matchmax.hk${path}`)), path).toBe(true);
    }
  });

  it("rejects non-GET, unprefixed, file and private app paths", () => {
    expect(isCacheablePageRequest(new Request("https://matchmax.hk/en", { method: "POST" }))).toBe(
      false,
    );
    for (const path of [
      "/tutors",
      "/_serverFn/x",
      "/sitemap.xml",
      "/en/robots.txt",
      "/en/admin",
      "/zh/dashboard/x",
      "/cn/account",
      "/en/auth",
      "/en/business/team",
    ]) {
      expect(isCacheablePageRequest(new Request(`https://matchmax.hk${path}`)), path).toBe(false);
    }
  });
});

describe("serveWithEdgeCache", () => {
  it("renders and stores a miss, then serves the hit without rendering", async () => {
    const cache = memoryCache();
    const ctx = setup("/en/tutors");
    const render = vi.fn(async () => html("v1"));

    const first = await serveWithEdgeCache({ ...ctx, cache, render, now: () => 0 });
    await ctx.flush();
    expect(await first.text()).toBe("v1");
    expect(first.headers.get("x-mm-cache")).toBe("MISS");

    const second = await serveWithEdgeCache({ ...ctx, cache, render, now: () => 1000 });
    expect(await second.text()).toBe("v1");
    expect(second.headers.get("x-mm-cache")).toBe("HIT");
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("does not leak the internal long cache lifetime to browsers", async () => {
    const cache = memoryCache();
    const ctx = setup("/en/tutors");
    await serveWithEdgeCache({ ...ctx, cache, render: async () => html("v1"), now: () => 0 });
    await ctx.flush();
    const hit = await serveWithEdgeCache({
      ...ctx,
      cache,
      render: async () => html("x"),
      now: () => 1,
    });
    expect(hit.headers.get("cache-control")).toBeNull();
    expect(hit.headers.get("x-mm-cached-at")).toBeNull();
  });

  it("serves stale content and refreshes it in the background", async () => {
    const cache = memoryCache();
    const ctx = setup("/en/tutors");
    await serveWithEdgeCache({ ...ctx, cache, render: async () => html("v1"), now: () => 0 });
    await ctx.flush();

    const staleAt = (FRESH_SECONDS + 1) * 1000;
    const render = vi.fn(async () => html("v2"));
    const stale = await serveWithEdgeCache({ ...ctx, cache, render, now: () => staleAt });
    expect(await stale.text()).toBe("v1");
    expect(stale.headers.get("x-mm-cache")).toBe("STALE");
    await ctx.flush();
    expect(render).toHaveBeenCalledTimes(1);

    const after = await serveWithEdgeCache({ ...ctx, cache, render, now: () => staleAt + 1 });
    expect(await after.text()).toBe("v2");
  });

  it("re-renders in the request once the stale window has passed", async () => {
    const cache = memoryCache();
    const ctx = setup("/en/tutors");
    await serveWithEdgeCache({ ...ctx, cache, render: async () => html("v1"), now: () => 0 });
    await ctx.flush();

    const expired = await serveWithEdgeCache({
      ...ctx,
      cache,
      render: async () => html("v2"),
      now: () => (STALE_SECONDS + 1) * 1000,
    });
    expect(await expired.text()).toBe("v2");
    expect(expired.headers.get("x-mm-cache")).toBe("MISS");
  });

  it("keeps builds apart so a deploy never serves old HTML", async () => {
    const cache = memoryCache();
    const old = setup("/en/tutors", "old");
    await serveWithEdgeCache({ ...old, cache, render: async () => html("old"), now: () => 0 });
    await old.flush();

    const next = setup("/en/tutors", "new");
    const res = await serveWithEdgeCache({
      ...next,
      cache,
      render: async () => html("new"),
      now: () => 1,
    });
    expect(await res.text()).toBe("new");
  });

  it("never stores errors, redirects, non-HTML, cookies or no-store responses", async () => {
    const uncacheable = [
      new Response("err", { status: 503, headers: { "content-type": "text/html" } }),
      new Response(null, { status: 301, headers: { location: "/en" } }),
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
      html("c", { headers: { "set-cookie": "a=b" } }),
      html("n", { headers: { "cache-control": "no-store" } }),
      html("p", { headers: { "cache-control": "private" } }),
    ];
    for (const response of uncacheable) {
      const cache = memoryCache();
      const ctx = setup("/en/tutors");
      await serveWithEdgeCache({ ...ctx, cache, render: async () => response, now: () => 0 });
      await ctx.flush();
      expect(cache.store.size).toBe(0);
    }
  });

  it("bypasses the cache entirely for uncacheable requests", async () => {
    const cache = memoryCache();
    const ctx = setup("/en/admin");
    const res = await serveWithEdgeCache({
      ...ctx,
      cache,
      render: async () => html("a"),
      now: () => 0,
    });
    await ctx.flush();
    expect(res.headers.get("x-mm-cache")).toBeNull();
    expect(cache.store.size).toBe(0);
  });

  it("falls back to rendering when the cache throws", async () => {
    const ctx = setup("/en/tutors");
    const broken: EdgeCache = {
      match: async () => {
        throw new Error("cache down");
      },
      put: async () => {
        throw new Error("cache down");
      },
    };
    const res = await serveWithEdgeCache({
      ...ctx,
      cache: broken,
      render: async () => html("ok"),
      now: () => 0,
    });
    await ctx.flush();
    expect(await res.text()).toBe("ok");
  });
});
