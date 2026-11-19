import { describe, expect, it } from "vitest";

import {
  contrabandMessage,
  isBlockedFileName,
  screenContraband,
} from "../../src/features/trust/safety-screen";

describe("#782 §2.3 contraband filter", () => {
  it("blocks banned terms (AC-755-C1)", () => {
    for (const text of [
      "太空油 有售",
      "selling weed cheap",
      "cheap vapes delivered",
      "電子煙 出售",
      "Buy guns here",
      "leaked exam questions 2026",
      "online casino tips",
      "nsfw pics",
    ]) {
      expect(screenContraband([text]), text).not.toBeNull();
    }
  });

  it("lets ordinary study text through (AC-755-C2)", () => {
    for (const text of [
      "Buy this method guide for IB Chem",
      "Drug delivery systems in Biology HL",
      "Nuclear weapons and the Cold War",
      "Probability: gambling problems in Maths",
      "Recreational drugs and the brain (Psychology)",
      "IB Biology cannabis policy essay",
      "DSE past paper walkthrough",
    ]) {
      expect(screenContraband([text]), text).toBeNull();
    }
  });

  it("blocks dangerous file types but not study files", () => {
    expect(isBlockedFileName("notes.pdf")).toBe(false);
    expect(isBlockedFileName("deck.apkg")).toBe(false);
    expect(isBlockedFileName("setup.EXE")).toBe(true);
    expect(isBlockedFileName("answers.zip")).toBe(true);
  });

  it("gives a bilingual reason", () => {
    const msg = contrabandMessage("drugs");
    expect(msg).toContain("MatchMax does not allow");
    expect(msg).toContain("MatchMax 不容許");
  });
});

describe("#782 §2.3 payload guard", () => {
  it("finds banned text anywhere in a save payload", async () => {
    const { findContrabandInPayload } = await import("../../src/features/trust/contraband.server");
    expect(
      findContrabandInPayload({ title: "IB Bio notes", tags: ["selling weed"] }),
    ).toMatchObject({ category: "drugs" });
    expect(findContrabandInPayload({ files: [{ fileName: "notes.exe" }] })).toMatchObject({
      category: "file_type",
    });
  });

  it("ignores embedded file payloads and clean listings", async () => {
    const { findContrabandInPayload } = await import("../../src/features/trust/contraband.server");
    expect(
      findContrabandInPayload({
        title: "Drug delivery in Biology",
        base64Data: "QUJD".repeat(300),
        cover: "data:image/png;base64,nsfw",
        fileName: "notes.pdf",
      }),
    ).toBeNull();
  });
});
