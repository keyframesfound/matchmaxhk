import { describe, expect, it } from "vitest";

import {
  UNDO_SESSION_WINDOW_HOURS,
  canUndoSession,
  rewardsConsumedForSessionLog,
  undoSessionError,
} from "@/features/tutors/experience";

const created = new Date("2026-11-25T02:00:00Z");
const base = {
  status: "pending",
  createdAt: created,
  now: new Date(created.getTime() + 60 * 60 * 1000),
  isOwner: true,
  isStaff: false,
  rewardsConsumed: false,
};

describe("#828 AC-A6 undoCompleteSession rule", () => {
  it("allows the owning tutor (or staff) within 2 hours of a pending log", () => {
    expect(UNDO_SESSION_WINDOW_HOURS).toBe(2);
    expect(undoSessionError(base)).toBeNull();
    expect(undoSessionError({ ...base, isOwner: false, isStaff: true })).toBeNull();
  });

  it("rejects after the window, on non-pending logs, for others, or when rewards were used", () => {
    const late = new Date(created.getTime() + (2 * 60 + 1) * 60 * 1000);
    expect(undoSessionError({ ...base, now: late })).toBe("UNDO_WINDOW_PASSED");
    expect(undoSessionError({ ...base, status: "verified" })).toBe("NOT_PENDING");
    expect(undoSessionError({ ...base, status: "disputed" })).toBe("NOT_PENDING");
    expect(undoSessionError({ ...base, isOwner: false })).toBe("NOT_YOUR_LOG");
    expect(undoSessionError({ ...base, rewardsConsumed: true })).toBe("REWARDS_CONSUMED");
  });

  it("no rewards store exists yet, and the client mirror matches the server rule", () => {
    expect(rewardsConsumedForSessionLog()).toBe(false);
    expect(canUndoSession("pending", created.toISOString(), base.now)).toBe(true);
    expect(
      canUndoSession("pending", created.toISOString(), new Date(created.getTime() + 3 * 3600000)),
    ).toBe(false);
  });
});
