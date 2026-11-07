import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows } from "@/features/cases/desk-db";

/**
 * Issue #585 — the always-on referral link: matchmax.hk/r/{handle}.
 *
 * Resolves the handle (or a raw referral code) to that tutor's referral
 * code and redirects to /join?ref=CODE, where the root-mounted
 * ReferralCapture stores the 30-day first-party attribution. Unknown
 * handles fall through to /join without poisoning the stored code.
 */

const resolveReferral = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ handle: z.string().trim().min(1).max(64) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ code: string | null }> => {
    const db = asAdminDb((await import("@/integrations/supabase/client.server")).supabaseAdmin);
    // Direct referral code hit.
    const byCode = await selectRows<{ id: string }>(db, "tutors", "id", [
      { col: "referral_code", op: "eq", value: data.handle },
    ]);
    if (byCode.length > 0) return { code: data.handle };
    // Handle → tutor card → referral code.
    const profiles = await selectRows<{ id: string }>(db, "profiles", "id", [
      { col: "handle", op: "eq", value: data.handle },
    ]);
    if (profiles[0]) {
      const tutors = await selectRows<{ referral_code: string | null }>(
        db,
        "tutors",
        "referral_code",
        [{ col: "user_id", op: "eq", value: profiles[0].id }],
      );
      if (tutors[0]?.referral_code) return { code: tutors[0].referral_code };
    }
    return { code: null };
  });

export const Route = createFileRoute("/r/$handle")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  loader: async ({ params }: { params: { handle: string } }) => {
    const { code } = await resolveReferral({ data: { handle: params.handle } });
    throw redirect({
      to: "/join",
      ...(code ? { search: { ref: code } } : {}),
    });
  },
  component: () => null,
});
