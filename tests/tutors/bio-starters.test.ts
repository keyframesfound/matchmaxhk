import { describe, expect, it } from "vitest";

import { appendBioSentence } from "../../src/features/tutors/bio-starters";

describe("appendBioSentence (#798 bio starters)", () => {
  it("fills an empty bio", () => {
    expect(appendBioSentence("", "Hello.")).toBe("Hello.");
    expect(appendBioSentence("   ", "Hello.")).toBe("Hello.");
  });

  it("never erases existing text", () => {
    expect(appendBioSentence("I teach IB Physics.", "Hello.")).toBe("I teach IB Physics.\nHello.");
  });

  it("appends on a new line after a trailing newline", () => {
    expect(appendBioSentence("Line one\n\n", "Line two")).toBe("Line one\nLine two");
  });

  it("preserves internal blank lines the tutor wrote", () => {
    expect(appendBioSentence("Para one\n\nPara two", "Extra")).toBe("Para one\n\nPara two\nExtra");
  });

  it("ignores an empty or whitespace-only starter", () => {
    expect(appendBioSentence("Existing", "   ")).toBe("Existing");
    expect(appendBioSentence("", "")).toBe("");
  });

  it("trims only the starter, not the tutor's own trailing spaces mid-text", () => {
    expect(appendBioSentence("A  b", "  C  ")).toBe("A  b\nC");
  });

  it("appends twice as two separate lines", () => {
    const once = appendBioSentence("Base", "One");
    expect(appendBioSentence(once, "Two")).toBe("Base\nOne\nTwo");
  });
});
