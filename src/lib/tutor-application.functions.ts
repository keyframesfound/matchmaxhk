import { createServerFn } from "@tanstack/react-start";

import { tutorApplicationSchema } from "./tutor-application.schema";

export const submitTutorApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tutorApplicationSchema.parse(input))
  .handler(async ({ data }) => {
    const { turnstileToken, ...application } = data;
    const secret = process.env.TURNSTILE_SECRET;
    const expectedHostnames = new Set(
      (process.env.TURNSTILE_HOSTNAMES ?? "")
        .split(",")
        .map((hostname) => hostname.trim())
        .filter(Boolean),
    );

    if (!secret || expectedHostnames.size === 0) {
      throw new Error("Application verification is unavailable.");
    }

    let result: { success?: boolean; action?: string; hostname?: string };
    try {
      const response = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          signal: AbortSignal.timeout(10_000),
          body: new URLSearchParams({ secret, response: turnstileToken }),
        },
      );
      if (!response.ok) throw new Error(`siteverify ${response.status}`);
      result = await response.json();
    } catch {
      throw new Error("Application verification failed.");
    }

    if (
      !result.success ||
      result.action !== "tutor_application" ||
      !result.hostname ||
      !expectedHostnames.has(result.hostname)
    ) {
      throw new Error("Application verification failed.");
    }

    const { sendTutorApplication } = await import("./tutor-application.server");
    await sendTutorApplication(application);
    return { ok: true as const };
  });
