import { describe, expect, it } from "vitest";

import {
  BYOS_PRIOR_CONTACT_WINDOW_DAYS,
  byosClaimRefusal,
  byosInviteExpired,
  byosInvitePath,
  byosPriorContactRefused,
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

describe("#737 the prior-contact refusal only looks back 180 days", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = new Date("2026-11-24T12:00:00.000Z");
  const daysAgo = (days: number) => new Date(now.getTime() - days * DAY).toISOString();

  it("refuses contact from inside the window (179 days ago)", () => {
    const prior = { ...noContact, matchedCase: true, lastContactAt: daysAgo(179) };
    expect(byosPriorContactRefused(prior, now)).toBe(true);
    expect(
      byosClaimRefusal({
        inviteStatus: "active",
        claimantIsTutor: false,
        prior: { ...noContact, trialIntro: true, lastContactAt: daysAgo(179) },
        now,
      }),
    ).toBe("prior_contact");
  });

  it("allows the waiver once the contact ages past the window (181 days)", () => {
    const prior = { ...noContact, matchedCase: true, lastContactAt: daysAgo(181) };
    expect(byosPriorContactRefused(prior, now)).toBe(false);
    expect(
      byosClaimRefusal({ inviteStatus: "active", claimantIsTutor: false, prior, now }),
    ).toBeNull();
  });

  it("treats exactly 180 days as outside the window", () => {
    expect(BYOS_PRIOR_CONTACT_WINDOW_DAYS).toBe(180);
    const prior = { ...noContact, tutorApplied: true, lastContactAt: daysAgo(180) };
    expect(byosPriorContactRefused(prior, now)).toBe(false);
    expect(
      byosPriorContactRefused(
        { ...noContact, tutorApplied: true, lastContactAt: daysAgo(180 - 0.001) },
        now,
      ),
    ).toBe(true);
  });

  it("keeps refusing history it cannot date", () => {
    expect(
      byosPriorContactRefused({ ...noContact, matchedCase: true, lastContactAt: null }, now),
    ).toBe(true);
    expect(
      byosPriorContactRefused({ ...noContact, matchedCase: true, lastContactAt: undefined }, now),
    ).toBe(true);
    expect(
      byosPriorContactRefused(
        { ...noContact, matchedCase: true, lastContactAt: "not-a-date" },
        now,
      ),
    ).toBe(true);
  });

  it("still grants a genuinely new off-platform student", () => {
    expect(byosPriorContactRefused(noContact, now)).toBe(false);
    expect(byosPriorContactRefused({ ...noContact, lastContactAt: daysAgo(1) }, now)).toBe(false);
  });
});

describe("#737 §3 the invite expires after 7 days", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = new Date("2026-11-24T12:00:00.000Z");
  const at = (offsetDays: number) => new Date(now.getTime() + offsetDays * DAY).toISOString();

  it("keeps a fresh invite and one that expires in a moment", () => {
    expect(byosInviteExpired(at(7), now)).toBe(false);
    expect(byosInviteExpired(at(0.001), now)).toBe(false);
  });

  it("expires exactly at the boundary, not after it", () => {
    expect(byosInviteExpired(at(0), now)).toBe(true);
    expect(byosInviteExpired(at(-1), now)).toBe(true);
  });

  it("does not expire a row with no or unparseable expiry", () => {
    expect(byosInviteExpired(null, now)).toBe(false);
    expect(byosInviteExpired(undefined, now)).toBe(false);
    expect(byosInviteExpired("not-a-date", now)).toBe(false);
  });

  it("refuses the waiver once expired, but a spent invite still reads as used", () => {
    expect(
      byosClaimRefusal({
        inviteStatus: "active",
        expired: true,
        claimantIsTutor: false,
        prior: noContact,
      }),
    ).toBe("expired");
    // Order matters: an already-claimed invite is not_active whatever the clock.
    expect(
      byosClaimRefusal({
        inviteStatus: "claimed",
        expired: true,
        claimantIsTutor: false,
        prior: noContact,
      }),
    ).toBe("not_active");
  });

  it("keeps the existing refusals when the invite is live", () => {
    expect(
      byosClaimRefusal({
        inviteStatus: "active",
        expired: false,
        claimantIsTutor: true,
        prior: noContact,
      }),
    ).toBe("own_invite");
  });
});
