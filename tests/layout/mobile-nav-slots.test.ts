import { describe, expect, it } from "vitest";

import { isMobileNavSlotActive, MOBILE_NAV_SLOTS } from "@/components/layout/mobile-nav-slots";
import en from "@/features/i18n/locales/en.json";
import zhCN from "@/features/i18n/locales/zh-CN.json";
import zhHK from "@/features/i18n/locales/zh-HK.json";

describe("mobile bottom bar slots (#674)", () => {
  it("renders the five slots in the locked left-to-right order", () => {
    expect(MOBILE_NAV_SLOTS.map((slot) => slot.key)).toEqual([
      "explore",
      "saved",
      "post",
      "notifications",
      "account",
    ]);
  });

  it("points Post at the existing study material flow and Notifications at its page", () => {
    const toByKey = Object.fromEntries(MOBILE_NAV_SLOTS.map((slot) => [slot.key, slot.to]));
    expect(toByKey.post).toBe("/account/notes/new");
    expect(toByKey.notifications).toBe("/notifications");
  });

  it("marks a slot active on its route and sub-routes, not on lookalike paths", () => {
    expect(isMobileNavSlotActive("/notifications", "/notifications")).toBe(true);
    expect(isMobileNavSlotActive("/me/settings", "/me")).toBe(true);
    expect(isMobileNavSlotActive("/members", "/me")).toBe(false);
  });

  it("has the locked EN and 繁中 copy for every slot", () => {
    const labels = (locale: { nav_mobile: Record<string, string> }) =>
      MOBILE_NAV_SLOTS.map((slot) => locale.nav_mobile[slot.labelKey.split(".")[1]]);
    expect(labels(en)).toEqual(["Explore", "Saved", "Post", "Notifications", "Account"]);
    expect(labels(zhHK)).toEqual(["探索", "收藏", "發佈教材", "通知", "帳戶"]);
    expect(labels(zhCN).every(Boolean)).toBe(true);
  });
});
