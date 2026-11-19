// Issue #768 Part 1: public availability read model for a tutor profile.
//
// Reads get_tutor_public_availability, which returns ONLY (tutor_id,
// day_of_week, hour, state) — open from the tutor's hourly column, occupied
// derived from confirmed FUTURE lessons. No student names, lesson titles or
// earnings can reach this layer, which is why the merge happens in the DB
// rather than by shipping lesson rows to the browser.
//
// Tolerant like the other public fetches (trending.ts, most-requested-stats.ts):
// on any failure this resolves null and the grid falls back to projecting the
// legacy column, so an un-migrated or briefly broken database degrades to
// "Open hours, no Occupied" instead of an empty section.
import { supabase } from "@/integrations/supabase/client";
import type { HourlyDay } from "./availability-hours-model";

/** ISO-8601 day_of_week from the RPC (1 = Monday) -> grid key. */
const DAY_BY_ISO: Record<number, HourlyDay> = {
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
  7: "sun",
};

export type PublicHourState = "open" | "occupied" | "closed";
export type PublicAvailability = Record<HourlyDay, PublicHourState[]>;

const DAY_KEYS: HourlyDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function emptyMatrix(): PublicAvailability {
  return Object.fromEntries(
    DAY_KEYS.map((day) => [day, Array<PublicHourState>(24).fill("closed")]),
  ) as PublicAvailability;
}

type AvailabilityRpc = (
  fn: "get_tutor_public_availability",
  args: { p_tutor_ids: string[] },
) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;

export async function fetchTutorPublicAvailability(
  tutorId: string,
): Promise<PublicAvailability | null> {
  if (!tutorId) return null;
  try {
    const rpc = supabase.rpc as unknown as AvailabilityRpc;
    const { data, error } = await rpc("get_tutor_public_availability", {
      p_tutor_ids: [tutorId],
    });
    if (error) throw error;
    if (!Array.isArray(data)) return null;

    const matrix = emptyMatrix();
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const day = DAY_BY_ISO[Number(row.day_of_week)];
      const hour = Number(row.hour);
      const state = row.state;
      if (!day || !Number.isInteger(hour) || hour < 0 || hour > 23) continue;
      if (state !== "open" && state !== "occupied") continue;
      // Occupied always wins, whatever order the rows arrive in.
      if (state === "occupied" || matrix[day][hour] !== "occupied") {
        matrix[day][hour] = state;
      }
    }
    return matrix;
  } catch (error) {
    console.warn(
      "[availability] get_tutor_public_availability unavailable; profile falls back to the legacy grid",
      error,
    );
    return null;
  }
}
