import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { setRuntimeBindings } from "./lib/runtime-env";

const CANONICAL_ORIGIN = "https://matchmax.hk";
const CANONICAL_HOST = new URL(CANONICAL_ORIGIN).hostname;
const CANONICAL_BYPASS_HOST_SUFFIXES = [".vercel.app", ".localhost", ".local"];
const CANONICAL_BYPASS_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

function hydrateProcessEnvFromBindings(env: unknown): void {
  if (typeof process === "undefined" || !process.env) return;
  if (!env || typeof env !== "object") return;

  for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
    if (typeof value !== "string" || !value.trim()) continue;
    if (typeof process.env[key] === "string" && process.env[key]!.trim()) continue;
    process.env[key] = value;
  }
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function shouldBypassCanonicalRedirect(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (CANONICAL_BYPASS_HOSTS.has(host)) return true;
  if (isPrivateOrLoopbackIpHost(host)) return true;
  return CANONICAL_BYPASS_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function isPrivateOrLoopbackIpHost(host: string): boolean {
  if (host.includes(":")) {
    return host === "::1";
  }

  const parts = host.split(".");
  if (parts.length !== 4) return false;
  if (parts.some((part) => !/^\d+$/.test(part))) return false;

  const octets = parts.map((part) => Number(part));
  if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;

  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;

  return false;
}

function getCanonicalRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();

  if (host === CANONICAL_HOST || shouldBypassCanonicalRedirect(host)) {
    return null;
  }

  url.protocol = "https:";
  url.hostname = CANONICAL_HOST;
  url.port = "";

  return Response.redirect(url.toString(), 308);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      setRuntimeBindings(env);
      hydrateProcessEnvFromBindings(env);

      const canonicalRedirect = getCanonicalRedirect(request);
      if (canonicalRedirect) {
        return canonicalRedirect;
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
