import { describe, expect, it } from "vitest";

import {
  appendToDescription,
  appendToTitle,
  titleBase,
} from "../../src/features/materials/listing-helpers";
import { decideNoteUpsell } from "../../src/features/materials/note-tutor-upsell";
import {
  earningsEstimate,
  PLATFORM_FEE_RATE,
} from "../../src/features/materials/marketplace-policy";

describe("#784 §2.6 listing-form helpers", () => {
  it("title chips append and never erase seller text (AC-784-FORM-3)", () => {
    expect(appendToTitle("", "IB Biology notes")).toBe("IB Biology notes");
    expect(appendToTitle("My HL guide", "IB Biology notes")).toBe("My HL guide · IB Biology notes");
    expect(appendToTitle("IB Biology notes", "ib biology notes")).toBe("IB Biology notes");
  });

  it("description starters append on a new paragraph", () => {
    expect(appendToDescription("", "What's inside:\n- ")).toBe("What's inside:\n-");
    expect(appendToDescription("Covers paper 1.", "Best for:\n- ")).toBe(
      "Covers paper 1.\n\nBest for:\n-",
    );
  });

  it("builds the chip base from the live fields", () => {
    expect(titleBase({ curriculum: "IB", subject: "Biology", topic: "Cell respiration" })).toBe(
      "IB Biology · Cell respiration",
    );
    expect(titleBase({ curriculum: "", subject: "", topic: "" })).toBe("");
  });

  it("uses the locked 2% (never the #672 tiers) in the seller breakdown (AC-784-FORM-1)", () => {
    const e = earningsEstimate(100, PLATFORM_FEE_RATE);
    expect(e.platform).toBe(2);
    expect(e.net).toBeCloseTo(100 - 2 - e.gateway, 2);
  });

  it("the per-listing 1-on-1 switch hides the #731 CTA (AC-784-FORM-4)", () => {
    const base = {
      isOwner: false,
      isCommunitySeller: false,
      tutorCode: "MM-T1",
      tutorTakingStudents: true,
      noteSubject: "Biology",
      viewerCases: [],
    };
    expect(decideNoteUpsell(base)).toBe("show");
    expect(decideNoteUpsell({ ...base, linkedToProfile: false })).toBe("hidden");
  });
});
