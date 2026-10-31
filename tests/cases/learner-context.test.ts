/**
 * Issue #459 §E: tutor case cards tell Parent-managed bookings apart from
 * Independent Students so the tutor frames the first message correctly.
 * Reuses cases.who_for (#437) as the learner_type signal.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { caseLearnerContext, parseWhoFor } from "../../src/features/cases/learner-context";

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("parseWhoFor", () => {
  it("keeps the three stored values", () => {
    expect(parseWhoFor("my_child")).toBe("my_child");
    expect(parseWhoFor("myself")).toBe("myself");
    expect(parseWhoFor("someone_else")).toBe("someone_else");
  });

  it("drops anything else to null (legacy rows predate #437)", () => {
    expect(parseWhoFor(null)).toBeNull();
    expect(parseWhoFor(undefined)).toBeNull();
    expect(parseWhoFor("")).toBeNull();
    expect(parseWhoFor("tutor")).toBeNull();
    expect(parseWhoFor(1)).toBeNull();
  });
});

describe("caseLearnerContext", () => {
  it("labels a child booking as a parent account", () => {
    expect(caseLearnerContext("my_child")).toBe("parent");
  });

  it("labels a self booking as an independent student", () => {
    expect(caseLearnerContext("myself")).toBe("independent");
  });

  it("falls back to the generic client line when unknown", () => {
    expect(caseLearnerContext("someone_else")).toBe("generic");
    expect(caseLearnerContext(null)).toBe("generic");
  });
});

describe("board wiring", () => {
  it("whitelists who_for on the public board columns", () => {
    const cases = source("../../src/lib/cases.functions.ts");
    const columns = cases.match(/const PUBLIC_CASE_COLUMNS =\s*"([^"]+)"/)?.[1] ?? "";
    expect(columns.split(", ")).toContain("who_for");
    // Contact data must stay off the board.
    expect(columns).not.toMatch(/contact_name|contact_phone/);
  });

  it("renders the learner badge from the identity row", () => {
    const card = source("../../src/features/cases/case-card.tsx");
    expect(card).toContain("caseLearnerContext(item.whoFor)");
  });
});
