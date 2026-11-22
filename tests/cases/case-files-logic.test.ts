import { describe, expect, it } from "vitest";

import {
  CASE_FILE_CATEGORIES,
  CASE_FILE_MAX_BYTES,
  CASE_FILE_MAX_MB,
  CASE_FILE_TYPES,
  caseFileError,
  caseFileStoragePath,
  isCaseFileCategory,
} from "../../src/features/cases/case-files";

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

describe("case file constants", () => {
  it("caps at 50 MB", () => {
    expect(CASE_FILE_MAX_MB).toBe(50);
    expect(CASE_FILE_MAX_BYTES).toBe(50 * 1024 * 1024);
  });

  it("allows exactly the five advertised types", () => {
    expect([...CASE_FILE_TYPES]).toEqual([PDF, "image/jpeg", "image/png", DOCX, PPTX]);
  });
});

describe("caseFileError", () => {
  it("refuses a .zip by name", () => {
    expect(caseFileError({ name: "notes.zip", contentType: PDF, size: 1024 })).toBe("FILE_ZIP");
  });

  it("refuses a .ZIP name case-insensitively", () => {
    expect(caseFileError({ name: "Past Paper.ZIP", contentType: PDF, size: 1024 })).toBe(
      "FILE_ZIP",
    );
  });

  it("refuses a zip by MIME even with an innocent name", () => {
    expect(caseFileError({ name: "notes.pdf", contentType: "application/zip", size: 1024 })).toBe(
      "FILE_ZIP",
    );
  });

  it("refuses the legacy x-zip-compressed MIME", () => {
    expect(
      caseFileError({ name: "notes.pdf", contentType: "application/x-zip-compressed", size: 1 }),
    ).toBe("FILE_ZIP");
  });

  it("puts ZIP ahead of size and type", () => {
    expect(
      caseFileError({ name: "dump.zip", contentType: "application/x-msdownload", size: 0 }),
    ).toBe("FILE_ZIP");
    expect(
      caseFileError({
        name: "dump.zip",
        contentType: "application/x-msdownload",
        size: CASE_FILE_MAX_BYTES + 1,
      }),
    ).toBe("FILE_ZIP");
  });

  it("rejects 50 MB + 1", () => {
    expect(
      caseFileError({ name: "booklet.pdf", contentType: PDF, size: CASE_FILE_MAX_BYTES + 1 }),
    ).toBe("FILE_TOO_LARGE");
  });

  it("accepts exactly 50 MB", () => {
    expect(
      caseFileError({ name: "booklet.pdf", contentType: PDF, size: CASE_FILE_MAX_BYTES }),
    ).toBeNull();
  });

  it("accepts every allowed type", () => {
    for (const contentType of CASE_FILE_TYPES) {
      expect(caseFileError({ name: "file", contentType, size: 2048 })).toBeNull();
    }
  });

  it("strips a content-type parameter before matching", () => {
    expect(
      caseFileError({ name: "scan.jpg", contentType: "image/jpeg; charset=binary", size: 10 }),
    ).toBeNull();
  });

  it("rejects a random type", () => {
    expect(
      caseFileError({ name: "setup.exe", contentType: "application/x-msdownload", size: 10 }),
    ).toBe("FILE_TYPE");
    expect(caseFileError({ name: "clip.mp4", contentType: "video/mp4", size: 10 })).toBe(
      "FILE_TYPE",
    );
  });

  it("rejects zero, negative and non-finite sizes as empty", () => {
    expect(caseFileError({ name: "a.pdf", contentType: PDF, size: 0 })).toBe("FILE_EMPTY");
    expect(caseFileError({ name: "a.pdf", contentType: PDF, size: -1 })).toBe("FILE_EMPTY");
    expect(caseFileError({ name: "a.pdf", contentType: PDF, size: Number.NaN })).toBe("FILE_EMPTY");
    expect(caseFileError({ name: "a.pdf", contentType: PDF, size: Infinity })).toBe("FILE_EMPTY");
  });

  it("checks emptiness before size and type", () => {
    expect(caseFileError({ name: "a.exe", contentType: "application/x-msdownload", size: 0 })).toBe(
      "FILE_EMPTY",
    );
  });
});

describe("caseFileStoragePath", () => {
  it("builds <caseId>/<now>-<random>-<name>", () => {
    expect(caseFileStoragePath("case-1", "Worksheet 1.pdf", 1700000000000, "abc123")).toBe(
      "case-1/1700000000000-abc123-Worksheet-1.pdf",
    );
  });

  it("strips ../ traversal and path separators", () => {
    const path = caseFileStoragePath("case-1", "../../etc/passwd", 1, "r");
    expect(path).toBe("case-1/1-r-etc-passwd");
    expect(path.includes("..")).toBe(false);
    expect(path.includes("/etc")).toBe(false);
  });

  it("flattens Windows-style separators", () => {
    const path = caseFileStoragePath("case-1", "..\\..\\windows\\system32\\evil.pdf", 1, "r");
    expect(path.split("/").slice(1).join("/").includes("\\")).toBe(false);
    expect(path.includes("..")).toBe(false);
    expect(path.endsWith(".pdf")).toBe(true);
  });

  it("keeps a long name's extension while capping the stem", () => {
    const path = caseFileStoragePath("case-1", `${"a".repeat(400)}.pptx`, 1, "r");
    const name = path.slice(path.lastIndexOf("/") + 1);
    // "1-r-" prefix, then the sanitised name capped at 120 including ".pptx".
    expect(name.startsWith("1-r-")).toBe(true);
    expect(name.endsWith(".pptx")).toBe(true);
    expect(name.slice("1-r-".length).length).toBeLessThanOrEqual(120);
  });

  it("keeps CJK file names (letters are allowed per script)", () => {
    expect(caseFileStoragePath("case-1", "數學 練習.pdf", 1, "r")).toBe("case-1/1-r-數學-練習.pdf");
  });

  it("falls back instead of producing an empty segment", () => {
    expect(caseFileStoragePath("case-1", "...", 1, "r")).toBe("case-1/1-r-file");
    expect(caseFileStoragePath("case-1", "a.pdf", 1, "%%%")).toBe("case-1/1-0-a.pdf");
  });
});

describe("isCaseFileCategory", () => {
  it("accepts the four categories", () => {
    expect([...CASE_FILE_CATEGORIES]).toEqual(["general", "pre_class", "homework", "post_class"]);
    for (const category of CASE_FILE_CATEGORIES) expect(isCaseFileCategory(category)).toBe(true);
  });

  it("rejects anything else", () => {
    for (const value of ["General", "exam", "", null, undefined, 3, {}]) {
      expect(isCaseFileCategory(value)).toBe(false);
    }
  });
});
