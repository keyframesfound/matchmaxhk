import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

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
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
