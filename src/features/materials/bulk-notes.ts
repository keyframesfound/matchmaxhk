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

const SHARED_PREFIX_MIN = 4;

/**
 * The suggested default: files sharing a name stem ("Bio Ch1", "Bio Ch2") look
 * like one pack, unrelated names like separate notes. The seller always confirms.
 */
export function suggestBulkMode(fileNames: readonly string[]): "pack" | "separate" {
  const titles = fileNames.map((name) => titleFromFileName(name).toLowerCase());
  if (titles.length < 2) return "separate";
  const first = titles[0];
  let length = 0;
  while (length < first.length && titles.every((title) => title[length] === first[length])) {
    length += 1;
  }
  return length >= SHARED_PREFIX_MIN ? "pack" : "separate";
}

/** Returns a new list with one item moved; out-of-range moves change nothing. */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
