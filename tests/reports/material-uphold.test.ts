/**
 * Regression guard for the #330 grok review blocker: material report uphold
 * used to write the dropped `is_published` column on digital_materials (the
 * column went away with the #203 status machine), which made EVERY material
 * uphold throw before the report row could move to `upheld`. The real
 * unpublish transition is status -> "hidden" (lifecycle "hide").
 *
 * Server fns aren't testable end-to-end, so this asserts on the source the
 * same way the failure would bite: the digital_materials uphold branch must
 * never reference is_published again.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  new URL("../../src/features/reports/reports.functions.ts", import.meta.url),
  "utf8",
);

function upholdBranch(): string {
  const start = SOURCE.indexOf('report.target_type === "material"', SOURCE.indexOf("uphold"));
  const end = SOURCE.indexOf("report.tutor_id", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return SOURCE.slice(start, end);
}

describe("material report uphold (#330 review)", () => {
  it("hides reported materials via the status machine, not is_published", () => {
    const block = upholdBranch();
    expect(block).toContain('"digital_materials"');
    expect(block).toContain('status: "hidden"');
    expect(block).not.toContain("is_published");
  });
});
