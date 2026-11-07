import { describe, expect, it } from "vitest";

import { checkPhoneGate, isHkMobile, isOtpRequired, toHkE164 } from "../../src/features/trust/phone-otp";

describe("+852 phone OTP gate (#529)", () => {
  it("accepts HK mobiles only", () => {
    expect(isHkMobile("9123 4567")).toBe(true);
    expect(isHkMobile("+852 6123 4567")).toBe(true);
    expect(isHkMobile("85291234567")).toBe(true);
    expect(isHkMobile("2123 4567")).toBe(false); // landline
    expect(isHkMobile("+44 7700 900123")).toBe(false);
  });

  it("formats E.164", () => {
    expect(toHkE164("9123-4567")).toBe("+85291234567");
    expect(toHkE164("123")).toBeNull();
  });

  it("is off unless the setting is true", () => {
    expect(isOtpRequired(null)).toBe(false);
    expect(isOtpRequired(true)).toBe(true);
    expect(checkPhoneGate({ required: false, verifiedPhone: null })).toEqual({ ok: true });
  });

  it("requires a verified HK phone matching the contact phone", () => {
    expect(checkPhoneGate({ required: true, verifiedPhone: null })).toEqual({
      ok: false,
      reason: "PHONE_NOT_VERIFIED",
    });
    expect(checkPhoneGate({ required: true, verifiedPhone: "447700900123" })).toEqual({
      ok: false,
      reason: "PHONE_NOT_HK",
    });
    expect(
      checkPhoneGate({ required: true, verifiedPhone: "85291234567", contactPhone: "6123 4567" }),
    ).toEqual({ ok: false, reason: "PHONE_MISMATCH" });
    expect(
      checkPhoneGate({ required: true, verifiedPhone: "85291234567", contactPhone: "9123 4567" }),
    ).toEqual({ ok: true });
  });
});
