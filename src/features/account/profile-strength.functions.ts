/**
 * Issue #673 — server fn feeding the unified Profile Strength card
 * (/calendar empty shell, Activity dashboard #670). One read, one pure
 * computation: the SAME module every surface uses.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows } from "@/features/cases/desk-db";
import { availabilityFreshness } from "@/features/cases/availability-freshness";
import { profileStrength, type ProfileStrengthResult } from "@/features/account/profile-strength";

export type MyProfileStrength = ProfileStrengthResult & {
  isTutor: boolean;
  /** Days since the last availability confirmation (null = never). */
  availabilityDaysSinceConfirmed: number | null;
};

export const getMyProfileStrength = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfileStrength> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutors = await selectRows<{
      id: string;
      display_name: string | null;
      bio: string | null;
      subjects: string[] | null;
      photo_url: string | null;
      hourly_rate: number | null;
      is_published: boolean;
      availability_grid: unknown;
      availability_confirmed_at: string | null;
    }>(
      db,
      "tutors",
      "id, display_name, bio, subjects, photo_url, hourly_rate, is_published, availability_grid, availability_confirmed_at",
      [{ col: "user_id", op: "eq", value: context.userId }],
    );
    const tutor = tutors[0];
    if (!tutor) {
      const base = profileStrength({
        role: "other",
        hasDisplayName: false,
        hasBio: false,
        subjectsCount: 0,
        hasPhoto: false,
        isPublished: false,
        hasRates: false,
        hasAvailability: false,
        hasWeeklyWindows: false,
      });
      return { ...base, isTutor: false, availabilityDaysSinceConfirmed: null };
    }
    const windows = await selectRows<{ weekday: number }>(db, "tutor_weekly_windows", "weekday", [
      { col: "tutor_id", op: "eq", value: tutor.id ?? "" },
    ]);
    const fresh = availabilityFreshness(tutor.availability_confirmed_at);
    const gridEmpty =
      !tutor.availability_grid ||
      !Object.values(tutor.availability_grid as Record<string, string[]>).some((rows) =>
        (rows ?? []).some((cell) => cell !== "u"),
      );
    const result = profileStrength({
      role: "tutor",
      hasDisplayName: Boolean(tutor.display_name?.trim()),
      hasBio: Boolean(tutor.bio?.trim()),
      subjectsCount: tutor.subjects?.length ?? 0,
      hasPhoto: Boolean(tutor.photo_url),
      isPublished: tutor.is_published,
      hasRates: (tutor.hourly_rate ?? 0) > 0,
      hasAvailability: !gridEmpty,
      hasWeeklyWindows: windows.length > 0,
      freshnessDeduction: fresh.strengthDeduction,
    });
    return {
      ...result,
      isTutor: true,
      availabilityDaysSinceConfirmed: fresh.daysSinceConfirmed,
    };
  });
