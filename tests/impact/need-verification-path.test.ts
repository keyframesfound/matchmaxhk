import { describe, expect, it } from "vitest";

import {
  NEED_VERIFICATION_BUCKET,
  NEED_VERIFICATION_MAX_BYTES,
  isOwnedNeedVerificationPath,
  needVerificationFileError,
  needVerificationPath,
} from "../../src/features/impact/need-verification-path";

/** Issue #794 §2.3: the private proof-document key and its upload rules. */
const USER = "4b1d0b6e-6f2f-4f7a-9c2a-0f6f5e4d3c2b";
const NOW = 1_763_812_800_000;
const RANDOM = "k3n8x2qa";

describe("needVerificationPath", () => {
  it("keeps every key inside the caller's own folder", () => {
    const path = needVerificationPath(USER, "CSSA letter.pdf", NOW, RANDOM);
    expect(path.startsWith(`${USER}/`)).toBe(true);
    expect(path).toBe(`${USER}/${NOW}-${RANDOM}-CSSA-letter.pdf`);
    expect(path.slice(USER.length + 1)).not.toContain("/");
  });

  it("cannot be climbed out of with a traversal name", () => {
    for (const name of [
      "../../etc/passwd.pdf",
      "..%2f..%2fsecret.pdf",
      "..\\..\\windows\\system32\\x.pdf",
      "....//....//x.docx",
    ]) {
      const path = needVerificationPath(USER, name, NOW, RANDOM);
      expect(path.startsWith(`${USER}/`)).toBe(true);
      expect(path).not.toContain("..");
      expect(path).not.toContain("\\");
      // Exactly one separator: the folder boundary.
      expect(path.split("/")).toHaveLength(2);
      expect(isOwnedNeedVerificationPath(USER, path)).toBe(true);
    }
  });

  it("keeps CJK names readable instead of stripping them", () => {
    const path = needVerificationPath(USER, "綜援證明 2026.pdf", NOW, RANDOM);
    expect(path).toContain("綜援證明");
    expect(path.endsWith(".pdf")).toBe(true);
  });

  it("lowercases the extension and preserves a long one", () => {
    expect(needVerificationPath(USER, "Letter.PDF", NOW, RANDOM).endsWith(".pdf")).toBe(true);
    expect(needVerificationPath(USER, "scan.JPEG", NOW, RANDOM).endsWith(".jpeg")).toBe(true);
  });

  it("falls back to a stable base when the name is empty or punctuation only", () => {
    const empty = needVerificationPath(USER, "", NOW, RANDOM);
    expect(empty).toBe(`${USER}/${NOW}-${RANDOM}-proof`);
    expect(needVerificationPath(USER, "   ", NOW, RANDOM)).toBe(empty);
    expect(needVerificationPath(USER, "../..", NOW, RANDOM)).toBe(empty);
    expect(needVerificationPath(USER, "封面.png", NOW, RANDOM)).not.toBe(empty);
  });

  it("caps the whole key under 120 characters even for a huge CJK name", () => {
    const path = needVerificationPath(USER, `${"證明文件".repeat(60)}.pdf`, NOW, RANDOM);
    expect(Array.from(path).length).toBeLessThanOrEqual(120);
    expect(path.endsWith(".pdf")).toBe(true);
    expect(path.startsWith(`${USER}/`)).toBe(true);
  });

  it("sanitises the random suffix and tolerates an unusable clock", () => {
    const path = needVerificationPath(USER, "a.png", Number.NaN, "../../bad*rand");
    expect(path).toBe(`${USER}/0-badrand-a.png`);
  });
});

describe("isOwnedNeedVerificationPath", () => {
  const mine = needVerificationPath(USER, "a.pdf", NOW, RANDOM);

  it("accepts only the caller's folder", () => {
    expect(isOwnedNeedVerificationPath(USER, mine)).toBe(true);
    expect(isOwnedNeedVerificationPath("someone-else", mine)).toBe(false);
    expect(isOwnedNeedVerificationPath(USER, `x/${USER}/a.pdf`)).toBe(false);
    expect(isOwnedNeedVerificationPath(USER, `${USER}`)).toBe(false);
  });

  it("rejects traversal and Windows separators", () => {
    expect(isOwnedNeedVerificationPath(USER, `${USER}/../other/a.pdf`)).toBe(false);
    expect(isOwnedNeedVerificationPath(USER, `${USER}\\a.pdf`)).toBe(false);
  });
});

describe("needVerificationFileError", () => {
  const ok = { name: "proof.pdf", contentType: "application/pdf", size: 1024 };

  it("accepts PDF, JPEG and PNG under the cap", () => {
    expect(needVerificationFileError(ok)).toBeNull();
    expect(
      needVerificationFileError({ ...ok, name: "p.jpg", contentType: "image/jpeg" }),
    ).toBeNull();
    expect(
      needVerificationFileError({ ...ok, name: "p.PNG", contentType: "image/png" }),
    ).toBeNull();
    expect(needVerificationFileError({ ...ok, size: NEED_VERIFICATION_MAX_BYTES })).toBeNull();
  });

  it("refuses a ZIP by name or by MIME before anything else", () => {
    expect(needVerificationFileError({ ...ok, name: "proof.zip" })).toBe("FILE_TYPE");
    expect(
      needVerificationFileError({ ...ok, contentType: "application/zip", size: 20_000_000 }),
    ).toBe("FILE_TYPE");
  });

  it("refuses over 10 MB and any non-proof type", () => {
    expect(needVerificationFileError({ ...ok, size: NEED_VERIFICATION_MAX_BYTES + 1 })).toBe(
      "FILE_TOO_LARGE",
    );
    expect(
      needVerificationFileError({
        ...ok,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toBe("FILE_TYPE");
    expect(needVerificationFileError({ ...ok, size: 0 })).toBe("FILE_TYPE");
  });

  it("names the private bucket the key lives in", () => {
    expect(NEED_VERIFICATION_BUCKET).toBe("access-verification");
  });
});
