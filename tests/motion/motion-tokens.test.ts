import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { duration, easing, spring, withReducedMotion } from "../../src/lib/motion-tokens";

/**
 * #713 §2.1 (AC-TOK-1): the DESIGN.md motion table has two halves — the React
 * spring presets in src/lib/motion-tokens.ts and the CSS mirror in
 * src/styles.css. They cannot import each other, so this test is the guard that
 * keeps them equal to each other and to the table in DESIGN.md.
 */
const stylesheet = readFileSync(new URL("../../src/styles.css", import.meta.url), "utf8");

function cssValue(name: string): string {
  const match = stylesheet.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return match?.[1].trim() ?? "";
}

describe("motion tokens match DESIGN.md", () => {
  it("exposes the three springs with their documented duration and bounce", () => {
    expect(spring.smooth).toMatchObject({ type: "spring", duration: 0.4, bounce: 0 });
    expect(spring.snappy).toMatchObject({ type: "spring", duration: 0.26, bounce: 0.12 });
    expect(spring.morph).toMatchObject({ type: "spring", duration: 0.42, bounce: 0.16 });
  });

  it("exposes the 0.12 / 0.16 / 0.18 / 0.24 / 0.48 duration ladder", () => {
    expect(Object.values(duration)).toEqual([0.12, 0.16, 0.18, 0.24, 0.48]);
  });

  it("mirrors each spring duration as a CSS custom property in milliseconds", () => {
    for (const name of ["smooth", "snappy", "morph"] as const) {
      expect(cssValue(`motion-duration-${name}`)).toBe(`${spring[name].duration * 1000}ms`);
    }
  });

  it("mirrors the duration ladder as CSS custom properties in milliseconds", () => {
    for (const [step, seconds] of Object.entries(duration)) {
      expect(cssValue(`motion-duration-${step}`)).toBe(`${seconds * 1000}ms`);
    }
  });

  it("mirrors every easing as the same cubic-bezier in CSS", () => {
    for (const name of ["smooth", "snappy", "morph", "fade"] as const) {
      expect(cssValue(`motion-ease-${name}`)).toBe(`cubic-bezier(${easing[name].join(", ")})`);
    }
  });

  it("keeps smooth bounce-free (a state report never overshoots)", () => {
    expect(spring.smooth.bounce).toBe(0);
  });

  it("collapses any transition to instant under reduced motion", () => {
    expect(withReducedMotion(true, spring.snappy)).toEqual({ duration: 0 });
    expect(withReducedMotion(false, spring.snappy)).toEqual(spring.snappy);
  });
});
