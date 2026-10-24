import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { findContactViolations } from "@/lib/contact-filter";
import { buildMaterialSlug, nextStatus, type MaterialStatus } from "@/features/materials/lifecycle";
import {
  FOLDER_DESCRIPTION_MAX_LEN,
  FOLDER_MAX_CHILDREN,
  FOLDER_PICKABLE_TYPES,
  FOLDER_TITLE_MAX_LEN,
  folderChildrenSumHkd,
  folderBulkSavings,
  validateFolderChildren,
  validateFolderForSubmit,
  type FolderChildInput,
} from "@/features/folders/folder-rules";
import { asAdminDb, type AdminDb } from "@/features/materials/storage-helpers";

/**
 * #392: tutor-side Topic Folder lifecycle. A folder is a digital_materials
 * row (material_type 'topic_folder', document_type 'folder') whose
 * price_hkd is the BULK price; contents live in topic_folder_items
 * (2–20 of the tutor's own PUBLISHED non-folder listings). Draft →
 * pending_review reuses nextStatus; children rows are delete+reinserted on
 * every save while the folder is draft/pending (service-role writes; the
 * table is RLS-deny for clients).
 */

const PUBLIC_BUCKET = "materials-previews";

type FolderRow = {
  id: string;
  tutor_id: string;
  title: string;
  slug: string | null;
  status: MaterialStatus;
  price_hkd: number;
  description: string | null;
  cover_image_path: string | null;
  rejection_reason: string | null;
};

const FOLDER_SELECT =
  "id, tutor_id, title, slug, status, price_hkd, description, cover_image_path, rejection_reason";

export type FolderEditorChild = {
  id: string;
  title: string;
  priceHkd: number;
  materialType: string;
};

export type FolderEditorPickerRow = {
  id: string;
  title: string;
  priceHkd: number;
  materialType: string;
};

export type FolderEditorData = {
  folder: {
    id: string;
    title: string;
    description: string | null;
    priceHkd: number;
    status: MaterialStatus;
    rejectionReason: string | null;
    coverUrl: string;
  } | null;
  children: FolderEditorChild[];
  picker: FolderEditorPickerRow[];
};

async function myTutorRow(db: AdminDb, userId: string): Promise<{ id: string }> {
  const { data, error } = await db
    .from<{ id: string }>("tutors")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message || "Failed to look up tutor account");
  if (!data) throw new Error("Your account is not linked to a tutor profile yet.");
  return data;
}

/** Owner-only load that works for every status (drafts included). */
async function loadOwnedFolder(db: AdminDb, folderId: string, tutorId: string): Promise<FolderRow> {
  const { data, error } = await db
    .from<FolderRow>("digital_materials")
    .select(FOLDER_SELECT)
    .eq("id", folderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Folder not found.");
  if (data.tutor_id !== tutorId) throw new Error("This folder belongs to another account.");
  if (data.status && !["draft", "pending_review", "rejected"].includes(data.status)) {
    throw new Error("Only draft or rejected folders can be edited here.");
  }
  return data;
}

function assertCleanFolderCopy(fields: { title?: string; description?: string }) {
  const labels: Record<string, string> = { title: "Title", description: "Description" };
  for (const [field, text] of Object.entries(fields)) {
    if (!text) continue;
    const violations = findContactViolations(text);
    if (violations.length > 0) {
      throw new Error(
        `${labels[field]} contains contact details (${violations
          .map((v) => v.match)
          .slice(0, 2)
          .join(", ")}). Remove them to save.`,
      );
    }
  }
}

async function generateUniqueFolderSlug(
  db: AdminDb,
  title: string,
  excludeId: string,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = buildMaterialSlug(title, attempt === 0 ? "folder" : `folder-${attempt + 1}`);
    const { data } = await db
      .from<{ id: string }>("digital_materials")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data || data.id === excludeId) return candidate;
  }
  return buildMaterialSlug(title, `folder-${Date.now().toString(36)}`);
}

/**
 * Load the children rows the folder currently points at (joined through
 * topic_folder_items), plus the tutor's pickable published listings.
 */
async function loadFolderChildren(
  db: AdminDb,
  folderId: string,
): Promise<Array<{ child_material_id: string }>> {
  const { data, error } = await db
    .from<{ child_material_id: string }>("topic_folder_items")
    .select("child_material_id")
    .eq("folder_id", folderId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

const FolderMetaInput = z.object({
  title: z.string().trim().max(FOLDER_TITLE_MAX_LEN).optional(),
  description: z.string().trim().max(FOLDER_DESCRIPTION_MAX_LEN).optional(),
  priceHkd: z.number().min(0).max(100_000).optional(),
  childIds: z.array(z.string().uuid()).max(FOLDER_MAX_CHILDREN).optional(),
});

const SaveFolderInput = FolderMetaInput.extend({ materialId: z.string().uuid().optional() });

/**
 * Create or update the signed-in tutor's folder draft. Any subset of meta;
 * childIds (when present) REPLACE the folder's contents after the pure
 * children gate passes (2–20, own published non-folder items).
 */
export const saveFolderDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) => SaveFolderInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    assertCleanFolderCopy({ title: data.title, description: data.description });

    const existing = data.materialId ? await loadOwnedFolder(db, data.materialId, tutor.id) : null;

    // Children validation is data-driven: the ids must resolve to the
    // tutor's own published pickable listings.
    let childRows: FolderChildInput[] = [];
    if (data.childIds) {
      if (data.childIds.length === 0) {
        childRows = [];
      } else {
        const { data: rows, error } = await db
          .from<{
            id: string;
            tutor_id: string;
            price_hkd: number;
            material_type: string;
            status: string;
          }>("digital_materials")
          .select("id, tutor_id, price_hkd, material_type, status")
          .in("id", data.childIds);
        if (error) throw new Error(error.message);
        const byId = new Map((rows ?? []).map((row) => [row.id, row]));
        childRows = data.childIds.map((id) => {
          const row = byId.get(id);
          return {
            materialId: id,
            priceHkd: Number(row?.price_hkd ?? 0),
            materialType: row?.material_type ?? null,
            tutorId: row?.tutor_id ?? null,
            status: row?.status ?? null,
          };
        });
      }
      const childErrors = validateFolderChildren(childRows, tutor.id);
      if (childErrors.length > 0) throw new Error(childErrors.join(" "));
    }

    if (existing) {
      const { error } = await db
        .from<never>("digital_materials")
        .update({
          ...(data.title != null ? { title: data.title } : {}),
          ...(data.description != null ? { description: data.description } : {}),
          ...(data.priceHkd != null ? { price_hkd: data.priceHkd } : {}),
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);

      if (data.childIds) {
        const { error: clearError } = await db
          .from<never>("topic_folder_items")
          .delete()
          .eq("folder_id", existing.id);
        if (clearError) throw new Error(clearError.message);
        if (childRows.length > 0) {
          const { error: itemsError } = await db.from<never>("topic_folder_items").insert(
            childRows.map((child, index) => ({
              folder_id: existing.id,
              child_material_id: child.materialId,
              position: index + 1,
            })),
          );
          if (itemsError) throw new Error(itemsError.message);
        }
      }
      return { folderId: existing.id };
    }

    const { data: inserted, error } = await db
      .from<{ id: string }>("digital_materials")
      .insert({
        tutor_id: tutor.id,
        title: data.title?.trim() || "Untitled folder",
        description: data.description ?? null,
        price_hkd: data.priceHkd ?? 0,
        curriculum_tag: "",
        material_type: "topic_folder",
        document_type: "folder",
        status: "draft",
        original_file_path: null,
        watermarked_preview_url: "",
        cover_image_path: null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (childRows.length > 0) {
      const { error: itemsError } = await db.from<never>("topic_folder_items").insert(
        childRows.map((child, index) => ({
          folder_id: inserted.id,
          child_material_id: child.materialId,
          position: index + 1,
        })),
      );
      if (itemsError) throw new Error(itemsError.message);
    }
    return { folderId: inserted.id };
  });

/**
 * Submit gate: full validation against the STORED row + children (the
 * cover rides uploadMaterialCover first), contact filter on title and
 * description, then draft/rejected → pending_review with slug +
 * submitted_at.
 */
export const submitFolderForReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) => z.object({ folderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);
    const existing = await loadOwnedFolder(db, data.folderId, tutor.id);

    const itemRows = await loadFolderChildren(db, existing.id);
    const childIds = itemRows.map((row) => row.child_material_id);
    const { data: childMeta } = await db
      .from<{
        id: string;
        tutor_id: string;
        price_hkd: number;
        material_type: string;
        status: string;
      }>("digital_materials")
      .select("id, tutor_id, price_hkd, material_type, status")
      .in("id", childIds.length > 0 ? childIds : ["00000000-0000-0000-0000-000000000000"]);
    const childInputs: FolderChildInput[] = childIds.map((id) => {
      const row = (childMeta ?? []).find((meta) => meta.id === id);
      return {
        materialId: id,
        priceHkd: Number(row?.price_hkd ?? 0),
        materialType: row?.material_type ?? null,
        tutorId: row?.tutor_id ?? null,
        status: row?.status ?? null,
      };
    });

    const errors = validateFolderForSubmit({
      title: existing.title,
      description: existing.description,
      priceHkd: Number(existing.price_hkd ?? 0),
      hasCover: Boolean(existing.cover_image_path),
      children: childInputs,
    });
    if (errors.length > 0) throw new Error(errors.join(" "));

    const title = existing.title.trim();
    assertCleanFolderCopy({ title, description: existing.description ?? undefined });

    const next = nextStatus(existing.status, "submit");
    if (!next) throw new Error("This folder cannot be submitted right now.");

    const { error } = await db
      .from<never>("digital_materials")
      .update({
        status: next,
        rejection_reason: null,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);

    if (!existing.slug) {
      const slug = await generateUniqueFolderSlug(db, title, existing.id);
      const { error: slugError } = await db
        .from<never>("digital_materials")
        .update({ slug })
        .eq("id", existing.id);
      if (slugError) throw new Error(slugError.message);
    }

    return { folderId: existing.id };
  });

/** Editor bootstrap: stored folder (if any), current children, picker list. */
export const getFolderEditorData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ folderId: z.string().uuid().optional() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<FolderEditorData> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutor = await myTutorRow(db, context.userId);

    const { data: pickerRows, error: pickerError } = await db
      .from<{
        id: string;
        title: string;
        price_hkd: number;
        material_type: string;
      }>("digital_materials")
      .select("id, title, price_hkd, material_type")
      .eq("tutor_id", tutor.id)
      .eq("status", "published")
      .in("material_type", [...FOLDER_PICKABLE_TYPES])
      .order("updated_at", { ascending: false })
      .limit(200);
    if (pickerError) throw new Error(pickerError.message);
    const picker: FolderEditorPickerRow[] = (pickerRows ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      priceHkd: Number(row.price_hkd ?? 0),
      materialType: row.material_type,
    }));

    if (!data.folderId) return { folder: null, children: [], picker };

    const { data: folderRows, error } = await db
      .from<FolderRow>("digital_materials")
      .select(FOLDER_SELECT)
      .eq("id", data.folderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!folderRows || folderRows.tutor_id !== tutor.id) {
      return { folder: null, children: [], picker };
    }

    const items = await loadFolderChildren(db, folderRows.id);
    const childIds = items.map((row) => row.child_material_id);
    let children: FolderEditorChild[] = [];
    if (childIds.length > 0) {
      const { data: childRows, error: childError } = await db
        .from<{ id: string; title: string; price_hkd: number; material_type: string }>(
          "digital_materials",
        )
        .select("id, title, price_hkd, material_type")
        .in("id", childIds);
      if (childError) throw new Error(childError.message);
      const byId = new Map((childRows ?? []).map((row) => [row.id, row]));
      children = childIds
        .map((id) => byId.get(id))
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .map((row) => ({
          id: row.id,
          title: row.title,
          priceHkd: Number(row.price_hkd ?? 0),
          materialType: row.material_type,
        }));
    }

    return {
      folder: {
        id: folderRows.id,
        title: folderRows.title,
        description: folderRows.description,
        priceHkd: Number(folderRows.price_hkd ?? 0),
        status: folderRows.status,
        rejectionReason: folderRows.rejection_reason,
        coverUrl: folderRows.cover_image_path
          ? (db.storage.from(PUBLIC_BUCKET).getPublicUrl(folderRows.cover_image_path).data
              ?.publicUrl ?? "")
          : "",
      },
      children,
      picker,
    };
  });

/** Convenience re-exports for the editor's "Save HK$X (Y%)" line. */
export { folderChildrenSumHkd, folderBulkSavings };
