import { describe, expect, it } from "vitest";

import {
  COCKPIT_MACROS,
  canSendBoth,
  cockpitFeeQuote,
  fillMacro,
  fpsMacroVars,
  marketVerdict,
} from "@/features/cases/cockpit";

describe("matching cockpit (#454)", () => {
  it("standard fee = rate × 1.5 × students, never × duration", () => {
    expect(cockpitFeeQuote({ rateHkd: 500, studentCount: 1, sessionLengthMinutes: 120 })).toEqual({
      ok: true,
      mode: "standard",
      amountHkd: 750,
    });
    expect(cockpitFeeQuote({ rateHkd: 400, studentCount: 2 })).toMatchObject({ amountHkd: 1200 });
  });

  it("short case = 20% of rate × hours × lessons", () => {
    expect(
      cockpitFeeQuote({
        rateHkd: 400,
        isShortCase: true,
        sessionLengthMinutes: 90,
        scheduledLessonCount: 5,
      }),
    ).toEqual({ ok: true, mode: "short", amountHkd: 600 });
    expect(cockpitFeeQuote({ rateHkd: 400, isShortCase: true })).toEqual({
      ok: false,
      reason: "SHORT_INPUT_MISSING",
    });
  });

  it("missing rate disables the fee", () => {
    expect(cockpitFeeQuote({ rateHkd: null })).toEqual({ ok: false, reason: "RATE_MISSING" });
  });

  it("flags budgets more than 20% below the band bottom", () => {
    expect(marketVerdict(200, 300)).toBe("low");
    expect(marketVerdict(240, 300)).toBe("ok");
    expect(marketVerdict(null, 300)).toBe("unknown");
  });

  it("Send both allows 1-2 tutors only", () => {
    expect(canSendBoth(0)).toBe(false);
    expect(canSendBoth(2)).toBe(true);
    expect(canSendBoth(3)).toBe(false);
  });

  it("fills macro vars and keeps missing ones visible", () => {
    expect(fillMacro("{{case_id}} @ {{rate}}", { case_id: "C-1" })).toBe("C-1 @ [rate?]");
  });

  it("fps macro uses the MM- memo and the displayed fee", () => {
    const fps = COCKPIT_MACROS.find((m) => m.key === "fps")!;
    const text = fillMacro(fps.text, fpsMacroVars("C-9", cockpitFeeQuote({ rateHkd: 500 })));
    expect(text).toContain("HK$750");
    expect(text).toContain("MM-C-9");
    expect(text).toContain("6199-1509");
  });
});
