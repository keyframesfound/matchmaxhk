import { createStart, createMiddleware } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

/**
 * #825 AC-CS-7: server-fn errors are converted to a Response by TanStack's
 * own handler, so request middleware cannot turn them into a 403. This
 * function middleware runs inside the server fn and stamps the response
 * status before rethrowing, which keeps the serialised error body while
 * making the HTTP status truthful (a guard that throws 403 now answers 403).
 */
const httpStatusMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => next())
  .server(async ({ next }) => {
    try {
      return await next();
    } catch (error) {
      if (error != null && typeof error === "object" && "statusCode" in error) {
        const code = Number((error as { statusCode?: unknown }).statusCode);
        if (Number.isInteger(code) && code >= 400 && code <= 599) {
          setResponseStatus(code);
        }
      }
      throw error;
    }
  });

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    // #diagnostics: a system-shaped failure becomes a row an engineer can
    // triage; a business-rule throw the UI already explains does not.
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const { logRequestError } = await import("@/features/diagnostics/error-log.server");
      const request = getRequest();
      if (request) await logRequestError(request, error, { onlySystem: true });
    } catch (logFailure) {
      console.warn("[error-log] middleware report failed:", logFailure);
    }
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [httpStatusMiddleware, attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
