import { describe, expect, it } from "vitest";

import {
  BULK_TITLE_MAX,
  bulkRowProblem,
  moveItem,
  suggestBulkMode,
  titleFromFileName,
  toBulkRows,
} from "../../src/features/materials/bulk-notes";

describe("bulk notes", () => {
  it("makes a readable title from a file name", () => {
    expect(titleFromFileName("Ch1_Cell-Bio.final.pdf")).toBe("Ch1 Cell Bio.final");
    expect(titleFromFileName(`${"a".repeat(200)}.pdf`)).toHaveLength(BULK_TITLE_MAX);
  });

  it("keeps a unique key per file, even with the same name", () => {
    const file = new File(["x"], "a.pdf");
    const keys = toBulkRows([file, file]).map((row) => row.key);
    expect(new Set(keys).size).toBe(2);
  });

  it("enforces HK$0 or at least HK$20, and allows a blank draft price", () => {
    expect(bulkRowProblem({ title: "A", price: "" })).toBeNull();
    expect(bulkRowProblem({ title: "A", price: "0" })).toBeNull();
    expect(bulkRowProblem({ title: "A", price: "20" })).toBeNull();
    expect(bulkRowProblem({ title: "A", price: "19" })).toBe("price");
    expect(bulkRowProblem({ title: " ", price: "20" })).toBe("title");
  });
});

describe("suggestBulkMode", () => {
  it("suggests a pack when names share a stem, otherwise separate", () => {
    expect(suggestBulkMode(["DSE Bio Ch1.pdf", "DSE Bio Ch2.pdf"])).toBe("pack");
    expect(suggestBulkMode(["Chem notes.pdf", "Physics paper.pdf"])).toBe("separate");
    expect(suggestBulkMode(["only.pdf"])).toBe("separate");
  });
});

describe("moveItem", () => {
  it("returns a new list with the item moved, and ignores out-of-range moves", () => {
    const list = ["a", "b", "c"];
    expect(moveItem(list, 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(list, 0, -1)).toEqual(list);
    expect(moveItem(list, 2, 1)).toEqual(list);
    expect(list).toEqual(["a", "b", "c"]);
  });
});
