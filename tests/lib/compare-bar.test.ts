import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Observe the store the way React's useSyncExternalStore does: subscribe a
// listener once, count notifications (visibility flips). The module notifies
// listeners only when visibility actually flips, never on no-op updates.
const listeners = new Set<() => void>();

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useSyncExternalStore: (subscribe: (cb: () => void) => () => void) => {
      subscribe(() => listeners.forEach((fn) => fn()));
      return undefined;
    },
  };
});

const { setCompareBarVisible, useCompareBarVisible } = await import("@/lib/compare-bar");

let flips: number;

beforeAll(() => {
  // Mount the hook ONCE and subscribe ONCE for the whole file — the module
  // keeps its own listener set, so per-test subscriptions would accumulate
  // and multiply notifications.
  useCompareBarVisible();
  listeners.add(() => {
    flips += 1;
  });
});

beforeEach(() => {
  setCompareBarVisible("tutors", false);
  setCompareBarVisible("cases", false);
  flips = 0;
});

describe("compare-bar visibility", () => {
  it("does not notify when nothing changes", () => {
    setCompareBarVisible("tutors", false);
    expect(flips).toBe(0);
  });

  it("notifies once when a source shows the bar", () => {
    setCompareBarVisible("tutors", true);
    expect(flips).toBe(1);
  });

  it("stays visible until every source hides it", () => {
    setCompareBarVisible("tutors", true);
    setCompareBarVisible("cases", true);
    expect(flips).toBe(1); // one flip total: hidden -> visible
    setCompareBarVisible("tutors", false);
    expect(flips).toBe(1); // no flip: cases still shown
    setCompareBarVisible("cases", false);
    expect(flips).toBe(2); // visible -> hidden
  });

  it("re-showing an already shown source does not double-notify", () => {
    setCompareBarVisible("tutors", true);
    expect(flips).toBe(1);
    setCompareBarVisible("tutors", true);
    expect(flips).toBe(1);
  });
});
