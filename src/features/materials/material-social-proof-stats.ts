// Issue #768 (Part 2 §3.A / §5 AC #4): material-level public counts for the
// note / course cards. Thin, tolerant fetch over the get_material_public_counts
// RPC, mirroring most-requested-stats.ts: the marketplace grid must never break
// because the aggregate is missing, so any RPC failure (including the RPC not
// being deployed yet) logs once and returns an empty Map. A missing entry makes
// the card show "New release" via selectMaterialCardSocialProof.
import { supabase } from "@/integrations/supabase/client";

export type MaterialPublicCounts = {
  /** Delivered order count (digital_materials.sold_count). */
  salesCount: number;
  /** Distinct accounts that saved the listing. */
  savesCount: number;
};

/** One aggregate call per grid/rail; never fan out past a single screenful. */
const MAX_IDS = 60;

/**
 * The generated Database types predate this RPC, so the call is typed here
 * rather than widening the whole client. Rows are validated in the loop below.
 */
type PublicCountsRpc = (
  fn: "get_material_public_counts",
  args: { p_ids: string[] },
) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;

function toCount(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

export async function fetchMaterialPublicCounts(
  ids: readonly string[],
): Promise<Map<string, MaterialPublicCounts>> {
  const unique = Array.from(new Set(ids.filter((id) => Boolean(id)))).slice(0, MAX_IDS);
  if (unique.length === 0) return new Map();
  try {
    const rpc = supabase.rpc as unknown as PublicCountsRpc;
    const { data, error } = await rpc("get_material_public_counts", { p_ids: unique });
    if (error) throw error;
    if (!Array.isArray(data)) return new Map();
    const counts = new Map<string, MaterialPublicCounts>();
    for (const raw of data) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const materialId = typeof row.material_id === "string" ? row.material_id : "";
      if (!materialId) continue;
      counts.set(materialId, {
        salesCount: toCount(row.sold_count),
        savesCount: toCount(row.saves_count),
      });
    }
    return counts;
  } catch (error) {
    console.warn(
      "[materials] get_material_public_counts unavailable; cards fall back to New release",
      error,
    );
    return new Map();
  }
}
