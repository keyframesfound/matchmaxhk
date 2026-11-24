/**
 * Issue #575 hole: `proof_image_path` is merged into the tutor's PUBLIC
 * achievements, and the upload writes inside `tutor-proofs/<userId>/` — so the
 * save must accept nothing outside the caller's own folder. Otherwise a tutor
 * can attach another tutor's certificate (or a generated preview asset) and
 * publish it as their own credential.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  normalizeProofPath,
  ownedProofPath,
  proofPrefix,
} from "../../src/features/tutors/proof.functions";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("ownedProofPath", () => {
  it("accepts a file the caller uploaded under their own prefix", () => {
    expect(ownedProofPath(ME, `tutor-proofs/${ME}/1700000000000-abc123.jpg`)).toBe(true);
    expect(ownedProofPath(ME, `tutor-proofs/${ME}/nested/dir/certificate.webp`)).toBe(true);
  });

  it("rejects another tutor's folder", () => {
    expect(ownedProofPath(ME, `tutor-proofs/${OTHER}/1700000000000-abc123.jpg`)).toBe(false);
  });

  it("rejects a prefix look-alike that only shares the characters", () => {
    expect(ownedProofPath(ME, `tutor-proofs/${ME}x/certificate.jpg`)).toBe(false);
    expect(ownedProofPath(ME, `tutor-proofs/${ME}-other/certificate.jpg`)).toBe(false);
  });

  it("rejects traversal that escapes into another folder", () => {
    expect(ownedProofPath(ME, `tutor-proofs/${ME}/../${OTHER}/certificate.jpg`)).toBe(false);
    expect(ownedProofPath(ME, `tutor-proofs/${ME}/../../previews/leak.jpg`)).toBe(false);
    expect(ownedProofPath(ME, `../tutor-proofs/${ME}/certificate.jpg`)).toBe(false);
  });

  it("rejects a generated asset and any other bucket folder", () => {
    expect(ownedProofPath(ME, "previews/1700000000000-hero.jpg")).toBe(false);
    expect(ownedProofPath(ME, "gigs/covers/abc.jpg")).toBe(false);
  });

  it("rejects empty, absolute and protocol-relative values", () => {
    expect(ownedProofPath(ME, "")).toBe(false);
    expect(ownedProofPath(ME, "   ")).toBe(false);
    expect(ownedProofPath(ME, "https://evil.example/certificate.jpg")).toBe(false);
    expect(ownedProofPath(ME, "//evil.example/certificate.jpg")).toBe(false);
    expect(ownedProofPath(ME, `tutor-proofs\\${ME}\\certificate.jpg`)).toBe(false);
  });

  it("rejects the folder itself, with no file name after the prefix", () => {
    expect(ownedProofPath(ME, `tutor-proofs/${ME}/`)).toBe(false);
    expect(ownedProofPath(ME, `tutor-proofs/${ME}`)).toBe(false);
  });

  it("never accepts anything when the caller id is missing", () => {
    expect(ownedProofPath("", `tutor-proofs/${ME}/certificate.jpg`)).toBe(false);
  });
});

describe("normalizeProofPath", () => {
  it("folds duplicate and leading slashes", () => {
    expect(normalizeProofPath(`/tutor-proofs//${ME}//a.jpg`)).toBe(`tutor-proofs/${ME}/a.jpg`);
  });

  it("resolves . and .. segments inside the same folder", () => {
    expect(normalizeProofPath(`tutor-proofs/${ME}/sub/../a.jpg`)).toBe(`tutor-proofs/${ME}/a.jpg`);
    expect(normalizeProofPath(`tutor-proofs/${ME}/./a.jpg`)).toBe(`tutor-proofs/${ME}/a.jpg`);
  });

  it("returns null when the path climbs out of the bucket", () => {
    expect(normalizeProofPath("../a.jpg")).toBeNull();
    expect(normalizeProofPath("/..")).toBeNull();
  });

  it("keeps ownedProofPath consistent with the upload prefix", () => {
    expect(proofPrefix(ME)).toBe(`tutor-proofs/${ME}/`);
    expect(ownedProofPath(ME, proofPrefix(ME) + "a.jpg")).toBe(true);
  });
});

describe("saveMyAchievementProofs wiring", () => {
  const src = source("../../src/features/tutors/proof.functions.ts");

  it("guards every incoming proof path before the achievements merge", () => {
    const guard = src.indexOf("ownedProofPath(context.userId, item.proof_image_path)");
    const merge = src.indexOf("const merged = data.achievements.map");
    expect(guard).toBeGreaterThan(-1);
    expect(merge).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(merge);
  });

  it("keeps the upload prefix the guard enforces", () => {
    expect(src).toContain("`tutor-proofs/${context.userId}/${");
  });
});
