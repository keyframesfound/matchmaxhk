/**
 * Issue #392: pure rules for Topic Folder listings, deliberately free of
 * Supabase / TanStack imports so the vitest suite exercises them directly
 * (tests/folders/folder-rules.test.ts, tests/materials/* precedent).
 *
 * A folder is a normal digital_materials row (material_type 'topic_folder',
 * document_type 'folder') whose price_hkd is the BULK price; its contents
 * live in topic_folder_items (2–20 of the tutor's own published non-folder
 * listings). Unlocking children reuses the #250 delivered is_grant shape.
 */

import { folderSavingsPercent } from "../materials/lifecycle";

export const FOLDER_MIN_CHILDREN = 2;
export const FOLDER_MAX_CHILDREN = 20;

/** Same caps as notes (gigs use 80; folders are shop listings like notes). */
export const FOLDER_TITLE_MAX_LEN = 160;
export const FOLDER_DESCRIPTION_MAX_LEN = 4000;

/**
 * Which listing kinds may be bundled into a folder. Folders never nest
 * (CHECK topic_folder_no_nesting + this list) and GIGS are services with a
 * fulfillment clock, auto-granting one would fake a service delivery, so
 * only file/video-bearing kinds are pickable.
 */
export const FOLDER_PICKABLE_TYPES = [
  "notes",
  "mock",
  "exemplar",
  "flashcards",
  "video_course",
  "general_course",
] as const;

export type FolderChildInput = {
  materialId: string;
  /** Present list price of the child (HK$). Free children count as 0. */
  priceHkd: number;
  materialType?: string | null;
  /** tutors.id of the child's owner, must equal the folder's tutor. */
  tutorId?: string | null;
  /** digital_materials.status of the child at save/submit time. */
  status?: string | null;
};

/**
 * Children gate: 2–20 of the tutor's OWN published non-folder listings, no
 * duplicates. Returns human-readable problems, empty array means clean.
 * `ownTutorId` is the folder owner's tutors.id; a child with a tutorId that
 * differs (or a non-published status) is rejected.
 */
export function validateFolderChildren(
  children: FolderChildInput[],
  ownTutorId?: string | null,
): string[] {
  const errors: string[] = [];
  if (children.length < FOLDER_MIN_CHILDREN || children.length > FOLDER_MAX_CHILDREN) {
    errors.push(
      `A folder needs between ${FOLDER_MIN_CHILDREN} and ${FOLDER_MAX_CHILDREN} items (got ${children.length}).`,
    );
  }

  const seen = new Set<string>();
  for (const child of children) {
    if (!child.materialId) {
      errors.push("Every folder item must be an existing listing.");
      continue;
    }
    if (seen.has(child.materialId)) {
      errors.push("The same listing cannot appear twice in one folder.");
    }
    seen.add(child.materialId);

    if (child.materialType === "topic_folder" || child.materialType === "folder") {
      errors.push("Folders cannot contain other folders.");
    }
    if (child.materialType === "gig") {
      errors.push("Services (gigs) cannot be bundled into a folder.");
    }
    if (
      child.materialType &&
      !(FOLDER_PICKABLE_TYPES as readonly string[]).includes(child.materialType)
    ) {
      errors.push("Folder items must be your own published notes, decks, or courses.");
    }
    if (ownTutorId && child.tutorId && child.tutorId !== ownTutorId) {
      errors.push("Folder items must be your own listings.");
    }
    if (child.status && child.status !== "published") {
      errors.push("Folder items must be published listings.");
    }
  }
  return errors;
}

/** Sum of the children's list prices (free children contribute 0). */
export function folderChildrenSumHkd(children: Array<Pick<FolderChildInput, "priceHkd">>): number {
  let sum = 0;
  for (const child of children) sum += Math.max(0, Number(child.priceHkd) || 0);
  return Math.round(sum * 100) / 100;
}

export type FolderSubmitInput = {
  title?: string | null;
  description?: string | null;
  priceHkd?: number | null;
  hasCover: boolean;
  children: FolderChildInput[];
};

/**
 * Submit gate: title/description caps, cover REQUIRED (big-cover shop
 * card), and the bulk price must be a whole HK$ amount with 0 < bulk < sum
 * of the children's list prices, the whole point of a folder is a real
 * discount (free children are allowed; they just contribute 0 to the sum).
 * Returns human-readable problems, empty array means clean.
 */
export function validateFolderForSubmit(input: FolderSubmitInput): string[] {
  const errors: string[] = [];

  const title = (input.title ?? "").trim();
  if (title.length < 3) errors.push("Title is required (at least 3 characters).");
  else if (title.length > FOLDER_TITLE_MAX_LEN) {
    errors.push(`Title must be ${FOLDER_TITLE_MAX_LEN} characters or fewer.`);
  }

  const description = (input.description ?? "").trim();
  if (description.length > FOLDER_DESCRIPTION_MAX_LEN) {
    errors.push(`Description must be ${FOLDER_DESCRIPTION_MAX_LEN} characters or fewer.`);
  }

  if (!input.hasCover) errors.push("A cover image is required for folders.");

  const price = input.priceHkd;
  if (price == null || Number.isNaN(price) || !Number.isInteger(price) || price <= 0) {
    errors.push("The bulk price must be a whole HK$ amount above 0.");
  } else {
    const sum = folderChildrenSumHkd(input.children);
    if (sum <= 0) {
      errors.push("At least one folder item must have a price above 0.");
    } else if (price >= sum) {
      errors.push("The bulk price must be lower than the items' combined price.");
    }
  }

  return errors;
}

/** Editor line: { savings, percent } for "Save HK$X (Y%)", 0 when no saving. */
export function folderBulkSavings(
  bulkHkd: number,
  children: FolderChildInput[],
): {
  savingsHkd: number;
  percent: number;
} {
  const sum = folderChildrenSumHkd(children);
  const savingsHkd = Math.round(Math.max(sum - Math.max(0, bulkHkd), 0) * 100) / 100;
  return { savingsHkd, percent: folderSavingsPercent(bulkHkd, sum) };
}
