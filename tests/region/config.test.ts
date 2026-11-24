// Issue #712 §2 (product lock, row 4) — the region dictionary. HK is the only
// live region, so every malformed or unknown input must fail safe to HK/AUD-free
// defaults instead of throwing. AU values are pinned here too: they are the
// contract the February 2027 /au launch reads.
import { describe, expect, it } from "vitest";

import {
  DEFAULT_REGION,
  REGION_CONFIG,
  regionConfig,
  resolveRegion,
  type RegionConfig,
  type RegionId,
} from "../../src/features/region/config";

const REGION_IDS: RegionId[] = ["HK", "AU"];

const STRING_FIELDS: ReadonlyArray<Exclude<keyof RegionConfig, "examPresets">> = [
  "currency",
  "currencyCode",
  "paymentRail",
  "contractorLaw",
  "safeguardingLaw",
  "idVerification",
  "transitLabel",
];

describe("resolveRegion", () => {
  it("defaults to HK when input is missing", () => {
    expect(DEFAULT_REGION).toBe("HK");
    expect(resolveRegion()).toBe("HK");
    expect(resolveRegion(undefined)).toBe("HK");
    expect(resolveRegion(null)).toBe("HK");
  });

  it("defaults to HK for empty and blank strings", () => {
    expect(resolveRegion("")).toBe("HK");
    expect(resolveRegion("   ")).toBe("HK");
  });

  it("defaults to HK for unknown values rather than throwing", () => {
    expect(resolveRegion("hk")).toBe("HK");
    expect(resolveRegion("HK")).toBe("HK");
    expect(resolveRegion("hong kong")).toBe("HK");
    expect(resolveRegion("nz")).toBe("HK");
    // Defensive: runtime callers may hand us a non-string (query parsing, JSON).
    expect(resolveRegion(123 as unknown as string)).toBe("HK");
  });

  it("resolves AU spellings case-insensitively", () => {
    expect(resolveRegion("au")).toBe("AU");
    expect(resolveRegion("AU")).toBe("AU");
    expect(resolveRegion("Australia")).toBe("AU");
    expect(resolveRegion(" australia ")).toBe("AU");
  });
});

describe("regionConfig", () => {
  it("returns the HK config for unset and unknown input", () => {
    expect(regionConfig()).toBe(REGION_CONFIG.HK);
    expect(regionConfig(null)).toBe(REGION_CONFIG.HK);
    expect(regionConfig("mars")).toBe(REGION_CONFIG.HK);
  });

  it("returns the AU config for AU input", () => {
    expect(regionConfig("au")).toBe(REGION_CONFIG.AU);
    expect(regionConfig("australia")).toBe(REGION_CONFIG.AU);
  });
});

describe("REGION_CONFIG", () => {
  it("covers every region id", () => {
    expect(Object.keys(REGION_CONFIG).sort()).toEqual([...REGION_IDS].sort());
  });

  it.each(REGION_IDS)("%s exposes every field with non-empty text", (region) => {
    const config = REGION_CONFIG[region];
    for (const field of STRING_FIELDS) {
      expect(typeof config[field], field).toBe("string");
      expect(config[field].trim(), field).not.toBe("");
    }
    expect(config.examPresets.length, "examPresets").toBeGreaterThan(0);
    for (const preset of config.examPresets) {
      expect(preset.trim(), "examPresets entry").not.toBe("");
    }
  });

  it("pins the HK values every live surface renders", () => {
    expect(REGION_CONFIG.HK).toEqual({
      currency: "HK$",
      currencyCode: "HKD",
      paymentRail: "FPS (轉數快)",
      contractorLaw: "Cap. 57 Independent Tutor (獨立導師)",
      safeguardingLaw: "Cap. 650",
      idVerification: "HKID + DSE/IB Transcript",
      transitLabel: "MTR Station",
      examPresets: ["DSE", "IB"],
    });
  });

  it("pins the pre-launch AU values for the UNSW rollout", () => {
    expect(REGION_CONFIG.AU).toEqual({
      currency: "A$",
      currencyCode: "AUD",
      paymentRail: "PayID / Osko",
      contractorLaw: "ABN Independent Contractor",
      safeguardingLaw: "NSW WWCC (Working With Children Check)",
      idVerification: "NSW WWCC + ATAR/HSC/IB Transcript",
      transitLabel: "Sydney Suburb / Train Line",
      examPresets: ["HSC ATAR", "IB", "Selective"],
    });
  });
});
