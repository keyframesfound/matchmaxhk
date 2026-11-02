import { describe, expect, it } from "vitest";

import {
  decideModeration,
  parseModerationReply,
} from "../../src/features/materials/note-moderation";

const clean = { categories: [], confidence: 0, reasonEn: "", reasonZh: "" };

describe("automatic publish decision", () => {
  it("publishes clean notes straight away", () => {
    expect(decideModeration({ regexFlags: [], ai: clean, uncheckable: false }).status).toBe(
      "published",
    );
  });
  it("rejects contact details and payment handles without the AI", () => {
    const d = decideModeration({ regexFlags: ["contact_details"], ai: null, uncheckable: false });
    expect(d.status).toBe("rejected");
    expect(d.reason).toMatch(/phone/);
  });
  it("rejects confident AI violations with the AI's reason", () => {
    const d = decideModeration({
      regexFlags: [],
      ai: {
        categories: ["sexual"],
        confidence: 0.9,
        reasonEn: "Sexual images.",
        reasonZh: "色情圖片。",
      },
      uncheckable: false,
    });
    expect(d).toEqual({ status: "rejected", reason: "Sexual images. 色情圖片。" });
  });
  it("sends unsure verdicts, AI outages and unreadable scans to staff", () => {
    const unsure = {
      categories: ["copyright" as const],
      confidence: 0.5,
      reasonEn: "",
      reasonZh: "",
    };
    expect(decideModeration({ regexFlags: [], ai: unsure, uncheckable: false }).status).toBe(
      "pending_review",
    );
    expect(decideModeration({ regexFlags: [], ai: null, uncheckable: false }).status).toBe(
      "pending_review",
    );
    expect(decideModeration({ regexFlags: [], ai: clean, uncheckable: true }).status).toBe(
      "pending_review",
    );
  });
  it("does not block notes that only mention an exam board or past papers", () => {
    expect(
      decideModeration({
        regexFlags: ["exam_authority", "past_paper"],
        ai: clean,
        uncheckable: false,
      }).status,
    ).toBe("published");
  });
});

describe("moderation reply parsing", () => {
  it("keeps known categories and clamps confidence", () => {
    const r = parseModerationReply(
      'Sure: {"categories":["Copyright","weird"],"confidence":3,"reason_en":"Official paper.","reason_zh":"官方試卷。"}',
    );
    expect(r).toEqual({
      categories: ["copyright"],
      confidence: 1,
      reasonEn: "Official paper.",
      reasonZh: "官方試卷。",
    });
  });
});
