/**
 * Regression guard for #409: digital_materials.is_published was dropped by
 * the #203 status machine. Selecting or filtering that column 500s the
 * admin materials desk and every staff material grant. Published packs are
 * status = 'published', same as the other post-#203 reads.
 *
 * Server fns aren't testable end-to-end in vitest, so this asserts on the
 * source the same way the failure would bite.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

function sliceBetween(text: string, startMarker: string, endMarker: string): string {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return text.slice(start, end);
}

describe("digital_materials published reads (#409)", () => {
  const materials = source("../../src/features/materials/materials.functions.ts");
  const orders = source("../../src/features/materials/orders.functions.ts");

  it("listAllMaterialsAdmin selects status and not the dropped is_published column", () => {
    const block = sliceBetween(
      materials,
      "export const listAllMaterialsAdmin",
      "export const updateMaterialAdmin",
    );
    expect(block).toContain('.from("digital_materials")');
    expect(block).toContain("status");
    expect(block).not.toContain("is_published");
  });

  it("staff grants filter published packs with status = 'published'", () => {
    const block = sliceBetween(
      orders,
      "export const staffGrantMaterials",
      "export type PayoutExportRow",
    );
    expect(block).toContain('.from("digital_materials")');
    expect(block).toContain('.eq("status", "published")');
    expect(block).not.toContain("is_published");
  });

  it("listPendingGigReviews already filters the status machine, not is_published", () => {
    const block = sliceBetween(
      materials,
      "export const listPendingGigReviews",
      "export const reviewGigListing",
    );
    expect(block).toContain('.from<PendingGigReviewRow>("digital_materials")');
    expect(block).toContain('.eq("status", "pending_review")');
    expect(block).not.toContain("is_published");
  });
});
