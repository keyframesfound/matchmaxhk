import { describe, expect, it } from "vitest";

import {
  isValidIanaTimeZone,
  suggestTimeZone,
} from "../../src/features/tutor-application/time-zone";

describe("isValidIanaTimeZone", () => {
  it("accepts real IANA zones", () => {
    expect(isValidIanaTimeZone("Asia/Hong_Kong")).toBe(true);
    expect(isValidIanaTimeZone("Europe/London")).toBe(true);
  });

  it("rejects unknown and empty zones", () => {
    expect(isValidIanaTimeZone("Not/AZone")).toBe(false);
    expect(isValidIanaTimeZone("")).toBe(false);
    expect(isValidIanaTimeZone("   ")).toBe(false);
  });
});

describe("suggestTimeZone", () => {
  it("uses the country default for Hong Kong", () => {
    expect(suggestTimeZone({ country: "Hong Kong", browserZone: "America/New_York" })).toEqual({
      zone: "Asia/Hong_Kong",
      source: "country",
    });
  });

  it("uses the country default for Mainland China", () => {
    expect(suggestTimeZone({ country: "Mainland China", browserZone: null })).toEqual({
      zone: "Asia/Shanghai",
      source: "country",
    });
  });

  it("falls back to the browser zone for a country without a default", () => {
    expect(
      suggestTimeZone({ country: "United States", browserZone: "America/Los_Angeles" }),
    ).toEqual({ zone: "America/Los_Angeles", source: "browser" });
  });

  it("returns no suggestion when the country has no default and there is no browser zone", () => {
    expect(suggestTimeZone({ country: "United States", browserZone: null })).toEqual({
      zone: null,
      source: "none",
    });
  });

  it("ignores an invalid browser zone", () => {
    expect(suggestTimeZone({ country: "United States", browserZone: "Not/AZone" })).toEqual({
      zone: null,
      source: "none",
    });
  });

  it("uses a valid browser zone for Other", () => {
    expect(suggestTimeZone({ country: "Other", browserZone: "Europe/Paris" })).toEqual({
      zone: "Europe/Paris",
      source: "browser",
    });
  });
});
