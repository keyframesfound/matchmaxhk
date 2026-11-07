import { describe, it, expect } from "vitest";

import {
  HIDDEN_CONTACT_TOKEN,
  OUTBOUND_REQUEST_CAP_24H,
  OPEN_PENDING_OUTBOUND_CAP,
  countOutboundRequests24h,
  decideRequest,
  declineCooldownUntil,
  extractCurricula,
  gateOutbound,
  isConnectIntentTag,
  isWithinCooldown,
  orderedPair,
  renderSanitizedNote,
  sanitizeIntroNote,
  tutorPairFilter,
  type ExistingEdge,
} from "../../src/features/connections/connections-pure";

/**
 * #617 Tutor Connections pure rules: sanitizer, ordered-pair state machine,
 * 30-day decline cooldown, outbound rate caps (10/24h + 25 open pending).
 * Server fns are not testable end-to-end (repo precedent).
 */

const NOW = new Date("2026-11-07T04:00:00.000Z");

function edge(partial: Partial<ExistingEdge> & { id: string }): ExistingEdge {
  return {
    status: "PENDING",
    requester_tutor_id: "tutor-b",
    cooldown_until: null,
    ...partial,
  };
}

describe("sanitizeIntroNote (#617 contact stripping)", () => {
  it("strips a bare 8-digit HK phone number", () => {
    expect(sanitizeIntroNote("call me 91234567")).toBe(`call me ${HIDDEN_CONTACT_TOKEN}`);
  });

  it("strips +852-prefixed numbers with separators", () => {
    expect(sanitizeIntroNote("+852 9123 4567")).toBe(HIDDEN_CONTACT_TOKEN);
    expect(sanitizeIntroNote("+852-9123-4567")).toBe(HIDDEN_CONTACT_TOKEN);
  });

  it("strips wa.me deep links", () => {
    expect(sanitizeIntroNote("wa.me/85291234567")).toBe(HIDDEN_CONTACT_TOKEN);
    expect(sanitizeIntroNote("https://wa.me/85291234567?text=hi")).toBe(HIDDEN_CONTACT_TOKEN);
  });

  it("strips whatsapp web links", () => {
    expect(sanitizeIntroNote("https://chat.whatsapp.com/AbC123")).toBe(HIDDEN_CONTACT_TOKEN);
  });

  it("strips t.me handles", () => {
    expect(sanitizeIntroNote("t.me/someone")).toBe(HIDDEN_CONTACT_TOKEN);
  });

  it("strips email addresses", () => {
    expect(sanitizeIntroNote("reach me at a@b.com thanks")).toBe(
      `reach me at ${HIDDEN_CONTACT_TOKEN} thanks`,
    );
  });

  it("folds full-width digits before matching", () => {
    expect(sanitizeIntroNote("９１２３４５６７")).toBe(HIDDEN_CONTACT_TOKEN);
  });

  it("strips a raw 11-digit 852-prefixed number", () => {
    expect(sanitizeIntroNote("85291234567")).toBe(HIDDEN_CONTACT_TOKEN);
  });

  it("keeps a clean note untouched", () => {
    expect(sanitizeIntroNote("Happy to co-teach DSE Maths on Saturdays.")).toBe(
      "Happy to co-teach DSE Maths on Saturdays.",
    );
  });

  it("over-masks rate-like digit pairs in the safe direction", () => {
    // "1200 1500" fits the 4+4 HK phone shape — masking is intentional.
    const out = sanitizeIntroNote("I charge 1200 1500 per month");
    expect(out).toContain(HIDDEN_CONTACT_TOKEN);
    expect(out).not.toContain("1200");
  });

  it("returns null for empty and non-string input", () => {
    expect(sanitizeIntroNote("")).toBeNull();
    expect(sanitizeIntroNote("   ")).toBeNull();
    expect(sanitizeIntroNote(null)).toBeNull();
    expect(sanitizeIntroNote(undefined)).toBeNull();
    expect(sanitizeIntroNote(12345)).toBeNull();
  });

  it("rejects notes over the 140-char cap", () => {
    expect(sanitizeIntroNote("a".repeat(141))).toBeNull();
    expect(sanitizeIntroNote("a".repeat(140))).toBe("a".repeat(140));
  });

  it("caps inflated output after token replacement", () => {
    const out = sanitizeIntroNote(`${"x".repeat(120)} 91234567`);
    expect(out).not.toBeNull();
    expect((out ?? "").length).toBeLessThanOrEqual(180);
  });
});

describe("renderSanitizedNote", () => {
  it("replaces the token with the localized placeholder", () => {
    expect(renderSanitizedNote(`whatsapp ${HIDDEN_CONTACT_TOKEN} ok`, "[Contact hidden]")).toBe(
      "whatsapp [Contact hidden] ok",
    );
  });

  it("passes notes without tokens through", () => {
    expect(renderSanitizedNote("plain note", "[x]")).toBe("plain note");
    expect(renderSanitizedNote(null, "[x]")).toBe("");
  });
});

describe("decideRequest (ordered-pair state machine)", () => {
  it("inserts when the pair has no edge", () => {
    expect(decideRequest(null, "tutor-a", NOW)).toEqual({ action: "insert" });
  });

  it("auto-accepts a mutual simultaneous request", () => {
    const existing = edge({ id: "edge-1", status: "PENDING", requester_tutor_id: "tutor-b" });
    expect(decideRequest(existing, "tutor-a", NOW)).toEqual({
      action: "accept_mutual",
      edgeId: "edge-1",
    });
  });

  it("rejects a duplicate of my own pending request (idempotent no-op)", () => {
    const existing = edge({ id: "edge-1", status: "PENDING", requester_tutor_id: "tutor-a" });
    expect(decideRequest(existing, "tutor-a", NOW)).toEqual({
      action: "reject",
      reason: "already_pending",
    });
  });

  it("rejects when already connected", () => {
    const existing = edge({ id: "edge-1", status: "ACCEPTED" });
    expect(decideRequest(existing, "tutor-a", NOW)).toEqual({
      action: "reject",
      reason: "already_connected",
    });
  });

  it("rejects while the decline cooldown is running", () => {
    const existing = edge({
      id: "edge-1",
      status: "DECLINED",
      cooldown_until: declineCooldownUntil(NOW),
    });
    expect(decideRequest(existing, "tutor-a", NOW)).toEqual({
      action: "reject",
      reason: "cooldown",
    });
  });

  it("reopens a declined pair once the cooldown has expired", () => {
    const existing = edge({
      id: "edge-1",
      status: "DECLINED",
      cooldown_until: "2026-11-01T00:00:00.000Z",
    });
    expect(decideRequest(existing, "tutor-a", NOW)).toEqual({
      action: "reopen",
      edgeId: "edge-1",
    });
  });

  it("reopens a disconnected pair freely", () => {
    const existing = edge({ id: "edge-1", status: "DISCONNECTED" });
    expect(decideRequest(existing, "tutor-a", NOW)).toEqual({
      action: "reopen",
      edgeId: "edge-1",
    });
  });

  it("rejects blocked pairs permanently", () => {
    const existing = edge({ id: "edge-1", status: "BLOCKED" });
    expect(decideRequest(existing, "tutor-a", NOW)).toEqual({
      action: "reject",
      reason: "already_connected",
    });
  });
});

describe("decline cooldown", () => {
  it("sets cooldown_until to now + 30 days", () => {
    const until = declineCooldownUntil(NOW);
    expect(new Date(until).getTime()).toBe(NOW.getTime() + 30 * 24 * 60 * 60 * 1000);
  });

  it("treats missing or unparseable cooldown as expired", () => {
    expect(isWithinCooldown(null, NOW)).toBe(false);
    expect(isWithinCooldown(undefined, NOW)).toBe(false);
    expect(isWithinCooldown("not-a-date", NOW)).toBe(false);
  });

  it("is boundary-exact", () => {
    const until = declineCooldownUntil(NOW);
    expect(isWithinCooldown(until, NOW)).toBe(true);
    expect(isWithinCooldown(until, new Date(NOW.getTime() + 1))).toBe(true);
    expect(isWithinCooldown(until, new Date(until))).toBe(false);
  });
});

describe("outbound rate caps", () => {
  it("counts only requests inside the rolling 24h window", () => {
    const stamps = [
      "2026-11-07T03:59:00.000Z", // inside
      "2026-11-07T00:00:01.000Z", // inside
      "2026-11-06T03:59:59.000Z", // 1s before the window start
      "2026-11-01T00:00:00.000Z", // a week old
      "garbage",
    ];
    expect(countOutboundRequests24h(stamps, NOW)).toBe(2);
  });

  it("gates at the daily cap first", () => {
    expect(gateOutbound(OUTBOUND_REQUEST_CAP_24H - 1, 0)).toBe("ok");
    expect(gateOutbound(OUTBOUND_REQUEST_CAP_24H, 0)).toBe("daily_cap");
    expect(gateOutbound(OUTBOUND_REQUEST_CAP_24H + 5, 0)).toBe("daily_cap");
  });

  it("gates at the open-pending cap", () => {
    expect(gateOutbound(3, OPEN_PENDING_OUTBOUND_CAP - 1)).toBe("ok");
    expect(gateOutbound(3, OPEN_PENDING_OUTBOUND_CAP)).toBe("pending_cap");
  });
});

describe("pair helpers", () => {
  it("orders the pair canonically", () => {
    expect(orderedPair("bbb", "aaa")).toEqual(["aaa", "bbb"]);
    expect(orderedPair("aaa", "bbb")).toEqual(["aaa", "bbb"]);
    expect(orderedPair("same", "same")).toEqual(["same", "same"]);
  });

  it("builds the PostgREST or-filter for both directions", () => {
    expect(tutorPairFilter("t-a", "t-b")).toBe(
      "and(requester_tutor_id.eq.t-a,recipient_tutor_id.eq.t-b)," +
        "and(requester_tutor_id.eq.t-b,recipient_tutor_id.eq.t-a)",
    );
  });
});

describe("extractCurricula (pricing_tiers payload)", () => {
  it("reads the curriculum labels, deduped and trimmed", () => {
    expect(
      extractCurricula([
        { curriculum: "DSE", rate: 400 },
        { curriculum: " DSE ", rate: 420 },
        { curriculum: "IB", rate: 500 },
      ]),
    ).toEqual(["DSE", "IB"]);
  });

  it("tolerates garbage payloads", () => {
    expect(extractCurricula(null)).toEqual([]);
    expect(extractCurricula("nope")).toEqual([]);
    expect(extractCurricula([{ rate: 1 }, { curriculum: 7 }, "x"])).toEqual([]);
  });
});

describe("intent tag vocabulary", () => {
  it("accepts exactly the four tags", () => {
    expect(isConnectIntentTag("SUBJECT_SPLIT")).toBe(true);
    expect(isConnectIntentTag("GROUP_COTEACH")).toBe(true);
    expect(isConnectIntentTag("RELIEF_COVER")).toBe(true);
    expect(isConnectIntentTag("CURRICULUM_PAIR")).toBe(true);
    expect(isConnectIntentTag("subject_split")).toBe(false);
    expect(isConnectIntentTag("FREE_PIZZA")).toBe(false);
    expect(isConnectIntentTag(null)).toBe(false);
  });
});
