import { describe, expect, it } from "vitest";

import { QUICK_REPLIES } from "../../src/features/cases/quick-replies";

/**
 * Issue #438 — the three insert-only quick replies. Copy must stay in sync
 * with the CS-005 V5.3 PART 2 triage table byte-for-byte (the clipboard is
 * the product), and nothing may auto-send.
 */
describe("desk quick replies (#438)", () => {
  it("ships exactly the three CS-005 buttons in desk order under desk.quick.*", () => {
    expect(QUICK_REPLIES.map((reply) => reply.key)).toEqual([
      "desk.quick.strike2",
      "desk.quick.rateNudge",
      "desk.quick.priceRange",
    ]);
  });

  it("Strike 2 copy is verbatim", () => {
    expect(QUICK_REPLIES[0].text).toBe("明白！最後想請問大約的預算（每小時）以及方便上堂的時間？");
  });

  it("Rate Nudge copy is verbatim (incl. the tutors-directory link)", () => {
    expect(QUICK_REPLIES[1].text).toBe(
      "明白您的要求。不過目前您填寫的預算/時間較難配對我們 Top 8 的獲認證導師。您可以考慮稍微調整預算，或者轉為網上課堂，配對成功率會大幅提升！或者您也可以在這裡直接瀏覽導師：https://matchmax.hk/tutors",
    );
  });

  it("Price Range copy is verbatim (incl. the tutors-directory link)", () => {
    expect(QUICK_REPLIES[2].text).toBe(
      "DSE Maths 大約 $250–$350/hr，IB HL 大約 $350–$500/hr。您可以先瀏覽我們的獲認證導師：https://matchmax.hk/tutors。如想我幫您查特定時間，請告訴我學制、科目和大致預算即可！",
    );
  });

  it("macro bodies stay out of i18n — text is carried in code, keys only label buttons", () => {
    for (const reply of QUICK_REPLIES) {
      expect(reply.key).toMatch(/^desk\.quick\.[a-zA-Z0-9]+$/);
    }
  });

  it("is insert-only: no wa.me / api.whatsapp send deep link rides along", () => {
    // The buttons copy text for the agent to paste themselves — the only
    // outbound URL allowed is the public tutors directory.
    for (const reply of QUICK_REPLIES) {
      expect(reply.text).not.toMatch(/wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com/);
      expect(reply.text).not.toMatch(/send=true/);
    }
  });
});
