import { createServerFn } from "@tanstack/react-start";

import { tutorApplicationSchema } from "./tutor-application.schema";

export const submitTutorApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tutorApplicationSchema.parse(input))
  .handler(async ({ data }) => {
    const { sendTutorApplication } = await import("./tutor-application.server");
    await sendTutorApplication(data);
    return { ok: true as const };
  });
