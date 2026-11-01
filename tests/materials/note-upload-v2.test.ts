import { describe, expect, it } from "vitest";

import {
  classifyUploadFile,
  detectLinkProvider,
  isImportFetchHost,
  isValidSubcategory,
  publicExtraLabel,
  toDirectImportUrl,
} from "../../src/features/materials/note-taxonomy";
import {
  defaultPreviewIndices,
  maxPreviewPagesFor,
  sanitizePreviewIndices,
} from "../../src/features/materials/preview-pages";
import { orderGrantsNoteAccess, summarizeRatings } from "../../src/features/materials/note-reviews";
import { normalizeNoteAiResult } from "../../src/features/materials/note-ai";
import { createSamplePdf, watermarkPdfPreview } from "../../src/features/materials/watermark";

describe("preview pages never expose the whole document", () => {
  it("defaults to ~30%, capped at 12 and below the page count", () => {
    expect(defaultPreviewIndices(40)).toHaveLength(12);
    expect(defaultPreviewIndices(10)).toEqual([0, 1, 2, 3, 4]);
    expect(defaultPreviewIndices(3)).toHaveLength(2);
    expect(defaultPreviewIndices(1)).toEqual([0]);
  });
  it("sanitises a seller pick", () => {
    expect(sanitizePreviewIndices([5, 2, 2, 99, -1], 10)).toEqual([2, 5]);
    expect(sanitizePreviewIndices([0, 1, 2, 3], 4)).toHaveLength(maxPreviewPagesFor(4));
    expect(sanitizePreviewIndices([], 10)).toEqual(defaultPreviewIndices(10));
  });
  it("watermarks exactly the picked pages", async () => {
    const pdf = await createSamplePdf(8);
    const out = await watermarkPdfPreview(pdf, { pageLimit: 3, pageIndices: [1, 4, 6] });
    expect(out.pageCount).toBe(3);
  });
});

describe("upload formats and links", () => {
  it("classifies files by extension", () => {
    expect(classifyUploadFile("Notes.PDF")).toBe("pdf");
    expect(classifyUploadFile("scan.jpeg")).toBe("image");
    expect(classifyUploadFile("essay.docx")).toBe("word");
    expect(classifyUploadFile("lecture.mp4")).toBe("video");
    expect(classifyUploadFile("virus.exe")).toBeNull();
  });
  it("detects cloud providers over https only", () => {
    expect(detectLinkProvider("https://drive.google.com/file/d/abc/view")).toBe("google_drive");
    expect(detectLinkProvider("https://docs.google.com/document/d/abc/edit")).toBe("google_docs");
    expect(detectLinkProvider("https://1drv.ms/b/s!abc")).toBe("onedrive");
    expect(detectLinkProvider("http://drive.google.com/file/d/abc")).toBeNull();
    expect(detectLinkProvider("https://evil.example.com/drive.google.com")).toBeNull();
  });
  it("builds direct import URLs", () => {
    expect(toDirectImportUrl("https://drive.google.com/file/d/1AbCdEfGhIjK/view?usp=sharing")).toBe(
      "https://drive.usercontent.google.com/download?id=1AbCdEfGhIjK&export=download&confirm=t",
    );
    expect(toDirectImportUrl("https://docs.google.com/document/d/1AbCdEfGhIjK/edit")).toBe(
      "https://docs.google.com/document/d/1AbCdEfGhIjK/export?format=pdf",
    );
    expect(toDirectImportUrl("https://www.dropbox.com/s/abc/notes.pdf?dl=0")).toContain("dl=1");
    expect(toDirectImportUrl("https://drive.google.com/drive/folders/1AbCdEfGhIjK")).toBeNull();
    expect(toDirectImportUrl("https://1drv.ms/b/s!abc")).toBeNull();
  });
  it("only fetches allowlisted hosts", () => {
    expect(isImportFetchHost("https://doc-0s-ai-docs.googleusercontent.com/x")).toBe(true);
    expect(isImportFetchHost("https://169.254.169.254/latest")).toBe(false);
    expect(isImportFetchHost("https://user:pw@drive.google.com/")).toBe(false);
    expect(isImportFetchHost("http://drive.google.com/")).toBe(false);
  });
  it("validates subcategories per curriculum", () => {
    expect(isValidSubcategory("IB", "ia")).toBe(true);
    expect(isValidSubcategory("DSE", "sba")).toBe(true);
    expect(isValidSubcategory("DSE", "ia")).toBe(false);
    expect(isValidSubcategory("IB", null)).toBe(true);
  });
});

describe("public extra labels", () => {
  it("hides file names / labels with contact details", () => {
    expect(publicExtraLabel("Chapter 3 slides.pptx")).toBe("Chapter 3 slides.pptx");
    expect(publicExtraLabel("wa 9123 4567.jpg")).toBeNull();
    expect(publicExtraLabel("WhatsApp 91234567")).toBeNull();
    expect(publicExtraLabel(null)).toBeNull();
  });
});

describe("reviews", () => {
  it("only access-granting orders may review", () => {
    expect(orderGrantsNoteAccess({ status: "delivered" })).toBe(true);
    expect(orderGrantsNoteAccess({ status: "released" })).toBe(true);
    expect(orderGrantsNoteAccess({ status: "awaiting_payment" })).toBe(false);
    expect(orderGrantsNoteAccess({ status: "refunded" })).toBe(false);
    // #543 checkout: access from payment, none while the buyer's dispute is open.
    expect(orderGrantsNoteAccess({ status: "paid_held" })).toBe(true);
    expect(orderGrantsNoteAccess({ status: "completed_released" })).toBe(true);
    expect(orderGrantsNoteAccess({ status: "disputed_frozen" })).toBe(false);
    expect(
      orderGrantsNoteAccess({ status: "refunded_from_hold", refund_amount: 10, gross_hkd: 100 }),
    ).toBe(true);
    expect(
      orderGrantsNoteAccess({ status: "refunded_from_hold", refund_amount: 100, gross_hkd: 100 }),
    ).toBe(false);
  });
  it("summarises ratings", () => {
    expect(summarizeRatings([5, 4, 4, 9])).toEqual({
      average: 4.3,
      count: 3,
      distribution: [0, 0, 0, 2, 1],
    });
    expect(summarizeRatings([]).average).toBeNull();
  });
});

describe("AI result normalisation", () => {
  it("coerces values onto the site's lists and strips contacts", () => {
    const result = normalizeNoteAiResult(
      JSON.stringify({
        title: "IB Biology IA guide, call 9123 4567",
        summary: "For IB students. Email me at a@b.com",
        description: "Covers design and analysis",
        curriculum: "IBDP",
        subject: "made-up subject",
        materialType: "notes",
        subcategory: "IA",
        topic: "Enzymes",
        year: 2025,
        language: "en",
        tags: ["IA", "內部評估", "x"],
        confidence: 2,
      }),
    );
    expect(result.curriculum).toBe("IB");
    expect(result.subject).toBe("");
    expect(result.subcategory).toBe("ia");
    expect(result.title).not.toContain("9123");
    expect(result.summary).not.toContain("@");
    expect(result.year).toBe("2025");
    expect(result.tags).toEqual(["IA", "內部評估"]);
    expect(result.confidence).toBe(1);
  });
  it("rejects non-JSON replies", () => {
    expect(() => normalizeNoteAiResult("sorry")).toThrow();
  });
});
