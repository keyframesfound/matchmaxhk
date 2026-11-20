import { describe, expect, it } from "vitest";

import { maskPayoutValue } from "../../src/features/account/payout-mask";
import { optionACopyKey } from "../../src/features/materials/marketplace-policy";

describe("#784 §2.2 payout details", () => {
  it("never shows the full number back (AC-585-3)", () => {
    expect(maskPayoutValue("91234567")).toBe("•••• 4567");
    expect(maskPayoutValue("012-345-678901")).toBe("•••• 8901");
    expect(maskPayoutValue("")).toBe("");
  });

  it("Studio payout copy follows the live contract switch", () => {
    expect(optionACopyKey("studio.payout_note", false)).toBe("studio.payout_note");
    expect(optionACopyKey("studio.payout_note", true)).toBe("notes_option_a.studio_payout_note");
    expect(optionACopyKey("studio.in_hold_hint", true)).toBe("notes_option_a.studio_in_hold_hint");
  });
});
