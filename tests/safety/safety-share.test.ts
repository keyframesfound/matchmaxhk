import { describe, expect, it } from "vitest";

import {
  buildShareBody,
  firstLiveLesson,
  formatVisitWindow,
  isAutoPromptEligible,
  isLikelyOnlineLocation,
  isValidHkPhone,
  normalizeWaDigits,
  sanitizeShareField,
  safetyShareStamp,
  shouldAutoPrompt,
  tutorFirstName,
  validateTrustedContact,
  whatsappShareUrl,
  SHARE_FIELD_MAX,
  TRUSTED_CONTACT_NAME_MAX,
  TRUSTED_CONTACT_PHONE_MAX,
} from "../../src/features/safety/safety-share";

/**
 * Issue #650 Safety lite — the share payload and auto-prompt rules as pure
 * functions. The payload MUST stay time window + tutor FIRST NAME + area:
 * no exact unit/flat/floor and no phone numbers ever enter the template.
 */

const EN_BODY = (parent: string, tutor: string, window: string, area: string) =>
  `${parent} is expecting tutor ${tutor} around ${window} in ${area}. Sent via MatchMax — no exact address included.`;

describe("buildShareBody (#650 copy lock)", () => {
  it("renders the exact EN template from the issue", () => {
    expect(
      buildShareBody(
        {
          parentName: "Chan Tai Man",
          tutorFirstName: "Kelvin",
          window: "Sat 8 Nov 14:00–15:00",
          area: "Sha Tin",
        },
        "en",
      ),
    ).toBe(EN_BODY("Chan Tai Man", "Kelvin", "Sat 8 Nov 14:00–15:00", "Sha Tin"));
  });

  it("renders the exact 繁中 template from the issue", () => {
    expect(
      buildShareBody(
        {
          parentName: "陳大文",
          tutorFirstName: "家聰",
          window: "11月8日 14:00–15:00",
          area: "沙田",
        },
        "zh-HK",
      ),
    ).toBe(
      "陳大文 預計導師 家聰 約於 11月8日 14:00–15:00 到訪 沙田。經 MatchMax 分享——不含詳細地址。",
    );
  });

  it("has no leftover placeholders and offers only the four locked fields", () => {
    const body = buildShareBody(
      { parentName: "P", tutorFirstName: "T", window: "W", area: "A" },
      "en",
    );
    expect(body).not.toMatch(/\{(ParentName|TutorFirstName|Window|Area)\}/);
    expect(body).not.toContain("Phone");
    expect(body).not.toContain("Address");
  });

  it("blank fields render as — so a half-filled sheet still previews", () => {
    expect(buildShareBody({ parentName: "", tutorFirstName: "", window: "", area: "" }, "en")).toBe(
      EN_BODY("—", "—", "—", "—"),
    );
  });
});

describe("sanitizeShareField / tutorFirstName", () => {
  it("trims and caps fields", () => {
    expect(sanitizeShareField("  x ".repeat(30))).toHaveLength(SHARE_FIELD_MAX);
    expect(sanitizeShareField("  hello  ")).toBe("hello");
  });

  it("keeps only the tutor's FIRST name", () => {
    expect(tutorFirstName("Kelvin Wong")).toBe("Kelvin");
    expect(tutorFirstName("家聰")).toBe("家聰"); // CJK names are one token
    expect(tutorFirstName(null)).toBe("");
    expect(tutorFirstName("   ")).toBe("");
  });
});

describe("auto-prompt eligibility (CEO lock: home visits only, once per case)", () => {
  it("never auto-prompts online-only cases", () => {
    expect(isAutoPromptEligible("online", null)).toBe(false);
    expect(isAutoPromptEligible("online", "Room 5, 3/F, 123 Nathan Rd")).toBe(false);
  });

  it("treats a meeting-link location as online even on in_person cases", () => {
    expect(isLikelyOnlineLocation("https://zoom.us/j/123456")).toBe(true);
    expect(isLikelyOnlineLocation("meet.google.com/abc-defg")).toBe(true);
    expect(isAutoPromptEligible("in_person", "https://zoom.us/j/123456")).toBe(false);
  });

  it("auto-prompts home-visit first lessons", () => {
    expect(isAutoPromptEligible("in_person", "3/F, 123 Nathan Rd")).toBe(true);
    expect(isAutoPromptEligible("either", null)).toBe(true);
    expect(isAutoPromptEligible(null, null)).toBe(true);
  });

  it("stops prompting once dismissed or shared (dismissible forever per case)", () => {
    expect(shouldAutoPrompt(null)).toBe(true);
    expect(shouldAutoPrompt({ dismissed_at: null, shared_at: null })).toBe(true);
    expect(shouldAutoPrompt({ dismissed_at: "2026-11-05T00:00:00Z", shared_at: null })).toBe(false);
    expect(shouldAutoPrompt({ dismissed_at: null, shared_at: "2026-11-05T00:00:00Z" })).toBe(false);
  });
});

describe("trusted-contact validation", () => {
  it("accepts a valid HK phone and trims the name", () => {
    const ok = validateTrustedContact("  Mom  ", "9123 4567");
    expect(ok).toEqual({ ok: true, displayName: "Mom", phone: "9123 4567" });
    expect(validateTrustedContact("Mom", "+852-9123-4567")).toMatchObject({ ok: true });
  });

  it("rejects missing names and non-HK phones", () => {
    expect(validateTrustedContact("   ", "91234567")).toMatchObject({
      ok: false,
      reason: "name_required",
    });
    expect(validateTrustedContact("Mom", "12345")).toMatchObject({
      ok: false,
      reason: "phone_invalid",
    });
    expect(isValidHkPhone("12345678")).toBe(false); // 1xx is not an HK prefix
    expect(isValidHkPhone("21234567")).toBe(true);
  });

  it("caps inputs at the DB CHECK bounds", () => {
    const long = "x".repeat(200);
    const ok = validateTrustedContact(long, "9123 4567");
    if (!ok.ok) throw new Error("expected ok");
    expect(ok.displayName.length).toBeLessThanOrEqual(TRUSTED_CONTACT_NAME_MAX);
    expect(ok.phone.length).toBeLessThanOrEqual(TRUSTED_CONTACT_PHONE_MAX);
  });
});

describe("WhatsApp deep link", () => {
  it("prefixes 852 for 8-digit HK numbers", () => {
    expect(normalizeWaDigits("9123 4567")).toBe("85291234567");
    expect(normalizeWaDigits("+852 9123 4567")).toBe("85291234567");
    expect(normalizeWaDigits("85291234567")).toBe("85291234567");
  });

  it("builds wa.me links with the prefilled message; recipient optional", () => {
    const url = whatsappShareUrl("91234567", "hello world");
    expect(url).toBe(`https://wa.me/85291234567?text=${encodeURIComponent("hello world")}`);
    // No saved contact: the parent picks the recipient in WhatsApp.
    expect(whatsappShareUrl(null, "hi")).toBe(`https://wa.me/?text=${encodeURIComponent("hi")}`);
  });
});

describe("lifecycle stamps", () => {
  it("seen stamps are insert-only (never carry dismissed/shared)", () => {
    expect(safetyShareStamp("seen")).toEqual({ prompt_seen_at: expect.any(String) });
    expect(safetyShareStamp("dismissed")).toMatchObject({ dismissed_at: expect.any(String) });
    expect(safetyShareStamp("shared")).toMatchObject({ shared_at: expect.any(String) });
    expect(Object.keys(safetyShareStamp("dismissed"))).not.toContain("shared_at");
    expect(Object.keys(safetyShareStamp("shared"))).not.toContain("dismissed_at");
  });
});

describe("firstLiveLesson", () => {
  it("picks the first non-cancelled lesson in sequence order", () => {
    const lessons = [
      { sequence: 1, status: "cancelled" },
      { sequence: 2, status: "planned" },
      { sequence: 3, status: "confirmed" },
    ];
    expect(firstLiveLesson(lessons)).toMatchObject({ sequence: 2 });
    expect(firstLiveLesson([{ sequence: 1, status: "late_cancel" }])).toBeNull();
    expect(firstLiveLesson([])).toBeNull();
  });
});

describe("formatVisitWindow", () => {
  it("formats an en window and picks zh-HK for zh locales", () => {
    // No Z suffix: parsed as LOCAL time, so the assertion is TZ-independent.
    expect(formatVisitWindow("2026-11-08T14:00:00", 60, "en")).toMatch(/^Sun 8 Nov 14:00–15:00$/);
    const zh = formatVisitWindow("2026-11-08T14:00:00", 90, "zh-HK");
    expect(zh).toContain("11月8日");
    expect(zh).toContain("14:00–15:30");
  });

  it("returns empty for an unparseable start", () => {
    expect(formatVisitWindow("not-a-date", 60, "en")).toBe("");
  });
});
