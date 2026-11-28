import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { LESSONS_ANCHOR_ID } from "../../src/features/cases/calendar-anchors";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

const CALENDAR_ROUTE = read("../../src/routes/_authenticated.calendar.tsx");
const SETTINGS_PAGE = read("../../src/features/settings/settings-page.tsx");

describe("#828 Calendar hub deep links", () => {
  it("shares one lessons anchor id between the link and the target", () => {
    expect(LESSONS_ANCHOR_ID).toBe("lessons");
  });

  it("links the Calendar hub to the Settings lessons tab through the constant", () => {
    expect(CALENDAR_ROUTE).toContain(
      'import { LESSONS_ANCHOR_ID } from "@/features/cases/calendar-anchors";',
    );
    expect(CALENDAR_ROUTE).toContain('to="/dashboard"');
    expect(CALENDAR_ROUTE).toContain("hash={LESSONS_ANCHOR_ID}");
    // A hardcoded hash would drift from the wrapper id, so fail if one survives.
    expect(CALENDAR_ROUTE).not.toContain('hash="lessons"');
  });

  it("puts the same id on the Settings Lessons tab wrapper", () => {
    expect(SETTINGS_PAGE).toContain(
      'import { LESSONS_ANCHOR_ID } from "@/features/cases/calendar-anchors";',
    );
    expect(SETTINGS_PAGE).toMatch(/<div id={LESSONS_ANCHOR_ID} className="space-y-6">/);
    expect(SETTINGS_PAGE).not.toContain('id="lessons"');
  });

  it("keeps the Calendar hub document title and its noindex", () => {
    expect(CALENDAR_ROUTE).toContain('{ title: "Calendar | MatchMax" }');
    expect(CALENDAR_ROUTE).toContain('{ name: "robots", content: "noindex" }');
  });
});
