/**
 * Notes upload v2: Carousell-style price guidance for sellers.
 *
 * Compares the seller's price with comparable PUBLISHED listings, widening
 * the comparison set tier by tier until there are at least
 * MIN_COMPARABLES (subcategory -> subject -> curriculum -> type). With too
 * few comparables the per-type baseline range is used instead. Pure;
 * unit-tested in tests/materials/price-guide.test.ts.
 */

export const MIN_COMPARABLES = 3;

export type PriceBaseline = { low: number; mid: number; high: number };

/** HKD baselines per material type (used when the market is too thin). */
export const PRICE_BASELINES: Record<string, PriceBaseline> = {
  notes: { low: 60, mid: 98, high: 150 },
  mock: { low: 40, mid: 78, high: 120 },
  exemplar: { low: 120, mid: 220, high: 380 },
  flashcards: { low: 30, mid: 50, high: 90 },
};

export type ComparableListing = {
  id: string;
  slug: string | null;
  title: string;
  priceHkd: number;
  materialType: string;
  curriculumTag: string;
  subjectTag: string | null;
  subcategory: string | null;
  pageCount: number | null;
};

export type PriceGuideTarget = {
  materialType: string;
  curriculumTag?: string | null;
  subjectTag?: string | null;
  subcategory?: string | null;
  pageCount?: number | null;
  excludeId?: string | null;
};

export type PriceGuideTier = "subcategory" | "subject" | "curriculum" | "type" | "baseline";

export type PriceVerdict = "too_low" | "low" | "competitive" | "high" | "too_high";

export type PriceGuide = {
  tier: PriceGuideTier;
  /** Suggested range (rounded to whole HKD). */
  low: number;
  mid: number;
  high: number;
  /** Market min / max of the comparables (or the baseline bounds). */
  min: number;
  max: number;
  sampleSize: number;
  comparables: ComparableListing[];
};

const eq = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase() && Boolean((a ?? "").trim());

/** Linear-interpolated percentile of a sorted array (p in 0..1). */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function roundPrice(value: number): number {
  return Math.max(0, Math.round(value));
}

/** Pick the narrowest tier with enough comparables. */
export function selectComparables(
  target: PriceGuideTarget,
  pool: ComparableListing[],
): { tier: PriceGuideTier; items: ComparableListing[] } {
  // Free listings are not a price signal.
  const sameType = pool.filter(
    (l) => l.id !== target.excludeId && l.materialType === target.materialType && l.priceHkd > 0,
  );
  const tiers: { tier: PriceGuideTier; items: ComparableListing[] }[] = [
    {
      tier: "subcategory",
      items: target.subcategory
        ? sameType.filter(
            (l) =>
              eq(l.curriculumTag, target.curriculumTag) &&
              eq(l.subjectTag, target.subjectTag) &&
              eq(l.subcategory, target.subcategory),
          )
        : [],
    },
    {
      tier: "subject",
      items: sameType.filter(
        (l) => eq(l.curriculumTag, target.curriculumTag) && eq(l.subjectTag, target.subjectTag),
      ),
    },
    {
      tier: "curriculum",
      items: sameType.filter((l) => eq(l.curriculumTag, target.curriculumTag)),
    },
    { tier: "type", items: sameType },
  ];
  for (const entry of tiers) {
    if (entry.items.length >= MIN_COMPARABLES) return entry;
  }
  return { tier: "baseline", items: [] };
}

/** Build the suggested range for a draft listing. */
export function buildPriceGuide(target: PriceGuideTarget, pool: ComparableListing[]): PriceGuide {
  const { tier, items } = selectComparables(target, pool);
  if (tier === "baseline") {
    const base = PRICE_BASELINES[target.materialType] ?? PRICE_BASELINES.notes;
    // Long documents nudge the baseline up a little (cap +40%).
    const pages = target.pageCount ?? 0;
    const factor = pages > 30 ? Math.min(1.4, 1 + (pages - 30) / 150) : 1;
    return {
      tier,
      low: roundPrice(base.low * factor),
      mid: roundPrice(base.mid * factor),
      high: roundPrice(base.high * factor),
      min: roundPrice(base.low * 0.5),
      max: roundPrice(base.high * 1.6 * factor),
      sampleSize: 0,
      comparables: [],
    };
  }
  const prices = items.map((l) => l.priceHkd).sort((a, b) => a - b);
  const sortedByCloseness = [...items].sort(
    (a, b) =>
      Math.abs(a.priceHkd - percentile(prices, 0.5)) -
      Math.abs(b.priceHkd - percentile(prices, 0.5)),
  );
  return {
    tier,
    low: roundPrice(percentile(prices, 0.25)),
    mid: roundPrice(percentile(prices, 0.5)),
    high: roundPrice(percentile(prices, 0.75)),
    min: roundPrice(prices[0]),
    max: roundPrice(prices[prices.length - 1]),
    sampleSize: items.length,
    comparables: sortedByCloseness.slice(0, 6),
  };
}

/**
 * Where a price sits against the guide:
 *  - too_low: under 60% of the low end (leaves money on the table)
 *  - low: below the range (very competitive, sells fast)
 *  - competitive: inside the suggested range
 *  - high: above the range (needs strong reviews / preview)
 *  - too_high: over 150% of the high end (likely to stall)
 */
export function priceVerdict(priceHkd: number, guide: Pick<PriceGuide, "low" | "high">) {
  if (!Number.isFinite(priceHkd) || priceHkd <= 0) return null;
  if (priceHkd < guide.low * 0.6) return "too_low" satisfies PriceVerdict;
  if (priceHkd < guide.low) return "low" satisfies PriceVerdict;
  if (priceHkd <= guide.high) return "competitive" satisfies PriceVerdict;
  if (priceHkd <= guide.high * 1.5) return "high" satisfies PriceVerdict;
  return "too_high" satisfies PriceVerdict;
}

/** 0..100 position of a value on the guide's min..max bar (clamped). */
export function barPosition(value: number, guide: Pick<PriceGuide, "min" | "max">): number {
  const span = Math.max(1, guide.max - guide.min);
  return Math.min(100, Math.max(0, ((value - guide.min) / span) * 100));
}
