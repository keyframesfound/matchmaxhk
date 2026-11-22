import { describe, expect, it } from "vitest";

import { conciergeReferMessage } from "../../src/features/connections/concierge-refer";

describe("#797 §2.4 Refer / Partner via Concierge", () => {
  it("names only public tutor codes, never contact details (Cap. 57)", () => {
    const en = conciergeReferMessage({ language: "en", targetCode: "MM-T104", myCode: "MM-T007" });
    expect(en).toContain("MM-T104");
    expect(en).toContain("MM-T007");
    expect(en).not.toMatch(/\d{8}|@|wa\.me/);
  });

  it("writes Traditional Chinese for zh visitors", () => {
    const zh = conciergeReferMessage({ language: "zh-HK", targetCode: "MM-T104", myCode: null });
    expect(zh).toContain("透過顧問合作轉介");
    expect(zh).not.toContain("我的導師編號");
  });
});
