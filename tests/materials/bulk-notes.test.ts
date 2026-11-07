import { describe, expect, it } from "vitest";

import {
  BULK_TITLE_MAX,
  bulkRowProblem,
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
