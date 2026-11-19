import { describe, expect, it } from "vitest";

import {
  byosClaimRefusal,
  byosInvitePath,
  hashInviteToken,
  isWellFormedInviteToken,
  newInviteToken,
  validateByosInvite,
} from "../../src/features/cases/byos";

const noContact = { matchedCase: false, trialIntro: false, tutorApplied: false };

describe("#783 §2.4 BYOS invite", () => {
  it("mints unique url-safe tokens and stores only a hash", async () => {
    const a = newInviteToken();
    const b = newInviteToken();
    expect(a).not.toBe(b);
    expect(isWellFormedInviteToken(a)).toBe(true);
    expect(isWellFormedInviteToken("short")).toBe(false);
    expect(isWellFormedInviteToken(`${a.slice(0, 42)}/`)).toBe(false);
    const hash = await hashInviteToken(a);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(a);
    expect(await hashInviteToken(a)).toBe(hash);
    expect(byosInvitePath(a)).toBe(`/invite/case/${a}`);
  });

  it("validates the invite form", () => {
    const ok = {
      inviteeLabel: "Chloe",
      subject: "IB Maths",
      level: "",
      hourlyRateHkd: 400,
      lessonMode: "online",
    };
    expect(validateByosInvite(ok)).toBeNull();
    expect(validateByosInvite({ ...ok, inviteeLabel: "  " })).toBe("label");
    expect(validateByosInvite({ ...ok, subject: "" })).toBe("subject");
    expect(validateByosInvite({ ...ok, hourlyRateHkd: 0 })).toBe("rate");
    expect(validateByosInvite({ ...ok, hourlyRateHkd: Number.NaN })).toBe("rate");
    expect(validateByosInvite({ ...ok, lessonMode: "" })).toBe("mode");
    expect(validateByosInvite({ ...ok, lessonMode: "f2f" })).toBeNull();
  });

  it("grants the waiver to a genuinely new off-platform student (AC-737-1)", () => {
    expect(
      byosClaimRefusal({ inviteStatus: "active", claimantIsTutor: false, prior: noContact }),
    ).toBeNull();
  });

  it("refuses the waiver on any prior on-platform contact (AC-737-2)", () => {
    for (const key of ["matchedCase", "trialIntro", "tutorApplied"] as const) {
      expect(
        byosClaimRefusal({
          inviteStatus: "active",
          claimantIsTutor: false,
          prior: { ...noContact, [key]: true },
        }),
      ).toBe("prior_contact");
    }
  });

  it("is one-time and cannot be self-claimed", () => {
    expect(
      byosClaimRefusal({ inviteStatus: "claimed", claimantIsTutor: false, prior: noContact }),
    ).toBe("not_active");
    expect(
      byosClaimRefusal({ inviteStatus: "revoked", claimantIsTutor: false, prior: noContact }),
    ).toBe("not_active");
    expect(
      byosClaimRefusal({ inviteStatus: "active", claimantIsTutor: true, prior: noContact }),
    ).toBe("own_invite");
  });
});
