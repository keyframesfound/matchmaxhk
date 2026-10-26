import { describe, expect, it } from "vitest";

import {
  FOLDER_MAX_CHILDREN,
  FOLDER_MIN_CHILDREN,
  folderBulkSavings,
  folderChildrenSumHkd,
  validateFolderChildren,
  validateFolderForSubmit,
  type FolderChildInput,
} from "../../src/features/folders/folder-rules";

const child = (overrides: Partial<FolderChildInput> = {}): FolderChildInput => ({
  materialId: "m-1",
  priceHkd: 50,
  materialType: "notes",
  tutorId: "tutor-1",
  status: "published",
  ...overrides,
});

describe("validateFolderChildren — 2–20 own published non-folder items", () => {
  it("accepts a clean 2-item bundle", () => {
    const errors = validateFolderChildren([
      child({ materialId: "a" }),
      child({ materialId: "b", priceHkd: 0 }),
    ]);
    expect(errors).toEqual([]);
  });

  it("rejects below the 2-item floor and above the 20-item cap", () => {
    expect(validateFolderChildren([child()]).join(" ")).toMatch(/between 2 and 20/);
    const tooMany = Array.from({ length: FOLDER_MAX_CHILDREN + 1 }, (_, i) =>
      child({ materialId: `m-${i}` }),
    );
    expect(validateFolderChildren(tooMany).join(" ")).toMatch(/between 2 and 20/);
    const atCap = Array.from({ length: FOLDER_MIN_CHILDREN + 18 }, (_, i) =>
      child({ materialId: `m-${i}` }),
    );
    expect(validateFolderChildren(atCap)).toEqual([]);
  });

  it("rejects nested folders and gigs", () => {
    const errors = validateFolderChildren([
      child({ materialId: "a", materialType: "topic_folder" }),
      child({ materialId: "b", materialType: "gig" }),
    ]);
    expect(errors.join(" ")).toMatch(/cannot contain other folders/);
    expect(errors.join(" ")).toMatch(/Services \(gigs\) cannot be bundled/);
  });

  it("rejects duplicates and other tutors' items", () => {
    const errors = validateFolderChildren(
      [child({ materialId: "a" }), child({ materialId: "a" })],
      "tutor-1",
    );
    expect(errors.join(" ")).toMatch(/cannot appear twice/);

    const foreign = validateFolderChildren(
      [child({ materialId: "a" }), child({ materialId: "b", tutorId: "tutor-2" })],
      "tutor-1",
    );
    expect(foreign.join(" ")).toMatch(/your own listings/);
  });

  it("rejects unpublished children", () => {
    const errors = validateFolderChildren([
      child({ materialId: "a" }),
      child({ materialId: "b", status: "draft" }),
    ]);
    expect(errors.join(" ")).toMatch(/must be published/);
  });
});

describe("folderChildrenSumHkd / folderBulkSavings — the editor's savings line", () => {
  it("sums children prices (free children count as 0)", () => {
    const sum = folderChildrenSumHkd([
      child({ priceHkd: 50 }),
      child({ materialId: "b", priceHkd: 30 }),
      child({ materialId: "c", priceHkd: 0 }),
    ]);
    expect(sum).toBe(80);
  });

  it("reports HK$ saved and the percent", () => {
    const savings = folderBulkSavings(60, [
      child({ priceHkd: 50 }),
      child({ materialId: "b", priceHkd: 30 }),
    ]);
    expect(savings.savingsHkd).toBe(20);
    expect(savings.percent).toBe(25);
  });

  it("reports zero when the bulk price is not a saving", () => {
    const savings = folderBulkSavings(100, [
      child({ priceHkd: 50 }),
      child({ materialId: "b", priceHkd: 50 }),
    ]);
    expect(savings.savingsHkd).toBe(0);
    expect(savings.percent).toBe(0);
  });
});

describe("validateFolderForSubmit — bulk must undercut the sum", () => {
  const base = {
    title: "IB Physics starter pack",
    description: "Two notes and a deck.",
    hasCover: true,
    children: [child({ priceHkd: 50 }), child({ materialId: "b", priceHkd: 30 })],
  };

  it("accepts a clean submission", () => {
    expect(validateFolderForSubmit({ ...base, priceHkd: 60 })).toEqual([]);
  });

  it("requires a title, a cover and a whole positive bulk price", () => {
    const errors = validateFolderForSubmit({
      title: "ab",
      description: null,
      hasCover: false,
      priceHkd: 0,
      children: base.children,
    });
    const joined = errors.join(" ");
    expect(joined).toMatch(/Title is required/);
    expect(joined).toMatch(/cover image is required/);
    expect(joined).toMatch(/above 0/);
  });

  it("rejects a bulk price at or above the children's sum", () => {
    const atSum = validateFolderForSubmit({ ...base, priceHkd: 80 }).join(" ");
    expect(atSum).toMatch(/must be lower than the items' combined price/);
    const aboveSum = validateFolderForSubmit({ ...base, priceHkd: 90 }).join(" ");
    expect(aboveSum).toMatch(/must be lower than the items' combined price/);
  });

  it("rejects when no child carries a price", () => {
    const errors = validateFolderForSubmit({
      ...base,
      priceHkd: 10,
      children: [child({ priceHkd: 0 }), child({ materialId: "b", priceHkd: 0 })],
    });
    expect(errors.join(" ")).toMatch(/At least one folder item must have a price above 0/);
  });
});
