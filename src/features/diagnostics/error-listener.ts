/**
 * Error pipeline: browser listeners.
 *
 * The router error boundary only sees render/navigation failures. A rejection
 * inside a background query, a timer, or an event handler never reaches it, so
 * these two listeners are the safety net. Reporting is fire-and-forget.
 */

import { reportClientError } from "@/features/diagnostics/error-logs.functions";

function send(message: string, stack?: string): void {
  void reportClientError({
    data: {
      url: typeof window === "undefined" ? "" : window.location.href,
      message,
      stack,
      userAgent: typeof navigator === "undefined" ? undefined : navigator.userAgent.slice(0, 500),
    },
  }).catch(() => undefined);
}

let installed = false;

/** Installs the listeners once per document; a second call is a no-op. */
export function installErrorListeners(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    const error = event.error instanceof Error ? event.error : null;
    send(error?.message ?? event.message ?? "Script error", error?.stack);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    if (reason instanceof Error) {
      send(reason.message || "Unhandled rejection", reason.stack);
      return;
    }
    send(
      typeof reason === "string" ? reason : `Unhandled rejection: ${String(reason).slice(0, 300)}`,
    );
  });
}
