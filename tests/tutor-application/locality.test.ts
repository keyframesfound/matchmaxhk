import { describe, expect, it } from "vitest";

import { localityPatch } from "../../src/features/tutor-application/locality";

/**
 * #798 AC-9: the intake must target the canonical `timezone` column, or a
 * confirmed zone never reaches scheduling (which reads `timezone`, not the
 * legacy `time_zone`).
 */
describe("#798 join intake locality patch", () => {
  it("maps the confirmed zone onto the canonical timezone column", () => {
    expect(localityPatch({ city: "Sydney", timeZone: "Australia/Sydney" })).toEqual({
      city: "Sydney",
      timezone: "Australia/Sydney",
    });
  });

  it("never emits the legacy time_zone key", () => {
    const patch = localityPatch({ timeZone: "Europe/London" });
    expect(Object.keys(patch)).toEqual(["timezone"]);
  });

  it("trims and drops blanks so the CHECK never sees an empty zone", () => {
    expect(localityPatch({ city: "  ", timeZone: "  " })).toEqual({});
    expect(localityPatch({ city: " Hong Kong ", timeZone: null })).toEqual({ city: "Hong Kong" });
  });

  it("omits fields the application did not carry", () => {
    expect(localityPatch({ city: "Kowloon" })).toEqual({ city: "Kowloon" });
    expect(localityPatch({})).toEqual({});
  });
});
