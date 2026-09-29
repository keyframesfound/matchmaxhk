import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names and resolves tailwind conflicts last-wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("drops falsy inputs", () => {
    const falsy = false as boolean | undefined;
    expect(cn("a", falsy && "b", undefined, "c")).toBe("a c");
  });
});
