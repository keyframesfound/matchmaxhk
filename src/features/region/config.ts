/**
 * Issue #712 §2 (product lock, row 4) — the region dictionary.
 *
 * HK is the only live region. Every surface in the app today renders Hong Kong
 * currency, the FPS instant-transfer rail, Cap. 57 / Cap. 650 framing and MTR
 * transit labels, so `DEFAULT_REGION` and `resolveRegion()` both fail safe to
 * `"HK"`. AU is pre-launch configuration only: it exists so the February 2027
 * UNSW Sydney rollout needs zero component refactoring, and it must not be
 * surfaced in the UI until the /au launch is explicitly unflagged.
 *
 * These strings are display configuration, never persistence: nothing here is a
 * DB column default, a stored amount, or a conversion input. Money maths stays
 * in `@/lib/money`, which is HKD-based.
 */

/** Region the app is rendering for. */
export type RegionId = "HK" | "AU";

/** Every region-specific display string, in one place. */
export type RegionConfig = {
  /** Display symbol prefixed to an amount, e.g. "HK$" in "HK$480". */
  currency: string;
  /** ISO 4217 code, e.g. "HKD" or "AUD". */
  currencyCode: string;
  /** Instant-transfer rail named in payment instructions. */
  paymentRail: string;
  /** How the tutor's self-employed status is described. */
  contractorLaw: string;
  /** Safeguarding check the region requires of tutors working with minors. */
  safeguardingLaw: string;
  /** Identity + transcript evidence a tutor must supply to be verified. */
  idVerification: string;
  /** How a lesson location is labelled. */
  transitLabel: string;
  /** Curriculum presets offered in exam / grade selectors. */
  examPresets: readonly string[];
};

/** HK is live; AU ships in February 2027 (see the module docstring). */
export const DEFAULT_REGION: RegionId = "HK";

export const REGION_CONFIG: Record<RegionId, RegionConfig> = {
  HK: {
    currency: "HK$",
    currencyCode: "HKD",
    paymentRail: "FPS (轉數快)",
    contractorLaw: "Cap. 57 Independent Tutor (獨立導師)",
    safeguardingLaw: "Cap. 650",
    idVerification: "HKID + DSE/IB Transcript",
    transitLabel: "MTR Station",
    examPresets: ["DSE", "IB"],
  },
  AU: {
    currency: "A$",
    currencyCode: "AUD",
    paymentRail: "PayID / Osko",
    contractorLaw: "ABN Independent Contractor",
    safeguardingLaw: "NSW WWCC (Working With Children Check)",
    idVerification: "NSW WWCC + ATAR/HSC/IB Transcript",
    transitLabel: "Sydney Suburb / Train Line",
    examPresets: ["HSC ATAR", "IB", "Selective"],
  },
};

/**
 * Maps arbitrary input (a query param, a config row, a stale link) to a region.
 * Case-insensitive; `au` / `australia` land on AU, everything else — including
 * empty, unknown and non-string runtime values — fails safe to HK. Never throws.
 */
export function resolveRegion(input?: string | null): RegionId {
  const key = typeof input === "string" ? input.trim().toLowerCase() : "";
  return key === "au" || key === "australia" ? "AU" : DEFAULT_REGION;
}

/** The config for `input`, resolved through {@link resolveRegion}. */
export function regionConfig(input?: string | null): RegionConfig {
  return REGION_CONFIG[resolveRegion(input)];
}
