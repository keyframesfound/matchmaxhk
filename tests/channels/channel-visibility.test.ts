import { describe, expect, it } from "vitest";

import {
  isChannelCardPublic,
  isSelfDeclaredAffiliation,
  visibleBirthdayMonthDay,
} from "../../src/features/channels/channel.functions";

/**
 * #548 P2 audit. The handlers themselves need Supabase, so the rules that
 * decide what a channel may render are extracted as pure functions and
 * pinned here: an alumni claim never reads as centre-confirmed, an anonymous
 * caller never receives the birthday badge, and an unpublished or banned
 * tutor card is not a public channel.
 */
describe("#548 P2 channel visibility", () => {
  describe("alumni affiliations are self-declared, never centre-confirmed", () => {
    it("marks the row requestAffiliation writes (no decision stamped)", () => {
      expect(
        isSelfDeclaredAffiliation({
          roleType: "alumni_student",
          decidedBy: null,
          userId: "u-claimant",
        }),
      ).toBe(true);
    });

    it("still marks legacy auto-approved rows the claimant stamped themselves", () => {
      expect(
        isSelfDeclaredAffiliation({
          roleType: "alumni_student",
          decidedBy: "u-claimant",
          userId: "u-claimant",
        }),
      ).toBe(true);
    });

    it("clears the marker once a centre admin decides the row", () => {
      expect(
        isSelfDeclaredAffiliation({
          roleType: "alumni_student",
          decidedBy: "u-centre-admin",
          userId: "u-claimant",
        }),
      ).toBe(false);
    });

    it("never marks an affiliated-tutor request, approved by the centre", () => {
      expect(
        isSelfDeclaredAffiliation({
          roleType: "affiliated_tutor",
          decidedBy: "u-centre-admin",
          userId: "u-tutor",
        }),
      ).toBe(false);
      expect(
        isSelfDeclaredAffiliation({
          roleType: "affiliated_tutor",
          decidedBy: null,
          userId: "u-tutor",
        }),
      ).toBe(false);
    });
  });

  describe("#522 birthday badge", () => {
    const dob = "1996-03-14";

    it("is omitted for anonymous callers", () => {
      expect(
        visibleBirthdayMonthDay({ viewerId: null, showBirthdayPublic: true, dateOfBirth: dob }),
      ).toBeNull();
    });

    it("returns month/day only (no year) to a logged-in viewer who opted in", () => {
      expect(
        visibleBirthdayMonthDay({
          viewerId: "u-viewer",
          showBirthdayPublic: true,
          dateOfBirth: dob,
        }),
      ).toBe("03-14");
    });

    it("stays hidden without the opt-in or without a date", () => {
      expect(
        visibleBirthdayMonthDay({
          viewerId: "u-viewer",
          showBirthdayPublic: false,
          dateOfBirth: dob,
        }),
      ).toBeNull();
      expect(
        visibleBirthdayMonthDay({
          viewerId: "u-viewer",
          showBirthdayPublic: null,
          dateOfBirth: dob,
        }),
      ).toBeNull();
      expect(
        visibleBirthdayMonthDay({
          viewerId: "u-viewer",
          showBirthdayPublic: true,
          dateOfBirth: null,
        }),
      ).toBeNull();
    });
  });

  describe("tutor card visibility (public channel returns no profile)", () => {
    const live = {
      isPublished: true,
      cardHiddenByBan: false,
      ownerAccountStatus: "active",
    };

    it("is public when published, unlocked and not banned", () => {
      expect(isChannelCardPublic(live)).toBe(true);
    });

    it("is not public when the card is unpublished", () => {
      expect(isChannelCardPublic({ ...live, isPublished: false })).toBe(false);
      expect(isChannelCardPublic({ ...live, isPublished: null })).toBe(false);
    });

    it("is not public when a ban or quarantine locked the card", () => {
      expect(isChannelCardPublic({ ...live, cardHiddenByBan: true })).toBe(false);
    });

    it("is not public when the owner account is banned", () => {
      expect(isChannelCardPublic({ ...live, ownerAccountStatus: "banned" })).toBe(false);
    });

    it("keeps a suspended owner's card up, matching the marketplace rule", () => {
      expect(isChannelCardPublic({ ...live, ownerAccountStatus: "suspended" })).toBe(true);
    });
  });
});
