import { describe, expect, it } from "vitest";

import {
  LOG_EDIT_WINDOW_HOURS,
  logEditWindowOpen,
} from "../../src/features/cases/super-drawer/super-drawer-logic";

/** Issue #796 §2.5 / AC-734-3: the Super-Drawer tutor edit window. */

const HOUR = 60 * 60 * 1000;
const SUBMITTED = "2026-11-20T09:00:00.000Z";
const submittedAt = Date.parse(SUBMITTED);
const at = (hours: number) => new Date(submittedAt + hours * HOUR).toISOString();

describe("logEditWindowOpen", () => {
  it("declares a 24-hour window", () => {
    expect(LOG_EDIT_WINDOW_HOURS).toBe(24);
  });

  it("is open one hour after submit", () => {
    expect(logEditWindowOpen({ loggedAt: SUBMITTED, now: at(1) })).toBe(true);
  });

  it("is closed at exactly 24 hours", () => {
    expect(logEditWindowOpen({ loggedAt: SUBMITTED, now: at(24) })).toBe(false);
  });

  it("stays closed at 25 hours", () => {
    expect(logEditWindowOpen({ loggedAt: SUBMITTED, now: at(25) })).toBe(false);
  });

  it("closes when the next lesson was logged 5 minutes ago, only 1h after submit", () => {
    expect(
      logEditWindowOpen({
        loggedAt: SUBMITTED,
        now: at(1),
        nextLessonLoggedAt: at(55 / 60),
      }),
    ).toBe(false);
  });

  it("is open while no later-lesson log exists", () => {
    expect(logEditWindowOpen({ loggedAt: SUBMITTED, now: at(2), nextLessonLoggedAt: null })).toBe(
      true,
    );
  });

  it("is closed when both limits have passed", () => {
    expect(
      logEditWindowOpen({
        loggedAt: SUBMITTED,
        now: at(30),
        nextLessonLoggedAt: at(25),
      }),
    ).toBe(false);
  });

  it("fails safe when loggedAt is unparseable", () => {
    expect(logEditWindowOpen({ loggedAt: "not-a-date", now: at(1) })).toBe(false);
  });

  it("ignores an unparseable nextLessonLoggedAt", () => {
    expect(
      logEditWindowOpen({
        loggedAt: SUBMITTED,
        now: at(1),
        nextLessonLoggedAt: "not-a-date",
      }),
    ).toBe(true);
  });
});
