import { validateListingPrice } from "@/features/materials/marketplace-policy";

/** #556: one row per dropped PDF when several become drafts in one go. */
export type BulkRow = { key: string; file: File; title: string; price: string };

export const BULK_TITLE_MAX = 80;

export function titleFromFileName(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, BULK_TITLE_MAX);
}

export function toBulkRows(files: readonly File[]): BulkRow[] {
  return files.map((file, index) => ({
    key: `${index}-${file.name}`,
    file,
    title: titleFromFileName(file.name),
    price: "",
  }));
}

/** A blank price is fine on a draft; a filled one must pass the listing rule. */
export function bulkRowProblem(row: Pick<BulkRow, "title" | "price">): "title" | "price" | null {
  if (!row.title.trim()) return "title";
  if (row.price.trim() === "") return null;
  return validateListingPrice(Number(row.price)) ? "price" : null;
}
