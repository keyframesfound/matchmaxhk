import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { selectRows, selectRowsOrEmpty, type Row } from "@/features/cases/desk-db";
import { MATERIAL_TYPES } from "@/features/materials/lifecycle";
import { asAdminDb, type AdminDb } from "@/features/materials/storage-helpers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { contactFilterError } from "@/lib/contact-filter";

/** #556: pack-only sales and light format variants for one listing. */

export type NoteVariant = { id: string; slug: string | null; label: string; priceHkd: number };
export type PackOnlyFolder = { id: string; slug: string | null; title: string };

const VARIANT_LABEL_MAX = 30;

/** The published pack that sells this item, when that pack is pack-only. */
export async function packOnlyFolderFor(
  db: AdminDb,
  materialId: string,
): Promise<PackOnlyFolder | null> {
  const items = await selectRowsOrEmpty<{ folder_id: string }>(
    db,
    "topic_folder_items",
    "folder_id",
    [{ col: "child_material_id", op: "eq", value: materialId }],
  );
  if (items.length === 0) return null;
  const folders = await selectRowsOrEmpty<PackOnlyFolder>(
    db,
    "digital_materials",
    "id, slug, title",
    [
      { col: "id", op: "in", value: items.map((item) => item.folder_id) },
      { col: "status", op: "eq", value: "published" },
      { col: "sell_children_separately", op: "eq", value: false },
    ],
  );
  return folders[0] ?? null;
}

export const getNoteStoreContext = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ materialId: z.string().uuid() }).parse(input))
  .handler(
    async ({ data }): Promise<{ packOnly: PackOnlyFolder | null; variants: NoteVariant[] }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = asAdminDb(supabaseAdmin);
      type VariantRow = {
        id: string;
        slug: string | null;
        title: string;
        price_hkd: number;
        variant_label: string | null;
        variant_of_id: string | null;
      };
      const columns = "id, slug, title, price_hkd, variant_label, variant_of_id";
      const self = await selectRowsOrEmpty<VariantRow>(db, "digital_materials", columns, [
        { col: "id", op: "eq", value: data.materialId },
      ]);
      const rootId = self[0]?.variant_of_id ?? data.materialId;
      const published = { col: "status", op: "eq" as const, value: "published" };
      const [root, siblings, packOnly] = await Promise.all([
        selectRowsOrEmpty<VariantRow>(db, "digital_materials", columns, [
          { col: "id", op: "eq", value: rootId },
          published,
        ]),
        selectRowsOrEmpty<VariantRow>(db, "digital_materials", columns, [
          { col: "variant_of_id", op: "eq", value: rootId },
          published,
        ]),
        packOnlyFolderFor(db, data.materialId),
      ]);
      const family = [...root, ...siblings];
      return {
        packOnly,
        variants:
          family.length < 2
            ? []
            : family.map((row) => ({
                id: row.id,
                slug: row.slug,
                label: row.variant_label ?? row.title,
                priceHkd: Number(row.price_hkd),
              })),
      };
    },
  );

/** The seller's own notes this listing could be a format of, plus its current link. */
export const getVariantPicker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ materialId: z.string().uuid().nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const owners = await selectRows<{ id: string }>(db, "tutors", "id", [
      { col: "user_id", op: "eq", value: context.userId },
    ]);
    if (!owners[0]) return { options: [], variantOfId: null, label: "" };
    const rows = await selectRowsOrEmpty<{
      id: string;
      title: string;
      variant_of_id: string | null;
      variant_label: string | null;
    }>(db, "digital_materials", "id, title, variant_of_id, variant_label", [
      { col: "tutor_id", op: "eq", value: owners[0].id },
      { col: "material_type", op: "in", value: [...MATERIAL_TYPES] },
    ]);
    const mine = rows.find((row) => row.id === data.materialId);
    return {
      // Flat families only: a variant cannot itself have variants.
      options: rows
        .filter((row) => row.id !== data.materialId && !row.variant_of_id)
        .map((row) => ({ id: row.id, title: row.title })),
      variantOfId: mine?.variant_of_id ?? null,
      label: mine?.variant_label ?? "",
    };
  });

export const setMaterialVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        materialId: z.string().uuid(),
        variantOfId: z.string().uuid().nullable(),
        label: z
          .string()
          .trim()
          .max(VARIANT_LABEL_MAX)
          .superRefine((text, ctx) => {
            const error = contactFilterError(text);
            if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
          }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const owners = await selectRows<{ id: string }>(db, "tutors", "id", [
      { col: "user_id", op: "eq", value: context.userId },
    ]);
    const tutorId = owners[0]?.id;
    if (!tutorId) throw new Error("Only sellers can link formats.");
    if (data.variantOfId) {
      if (data.variantOfId === data.materialId) throw new Error("Pick a different note.");
      const [target, children] = await Promise.all([
        selectRows<{ variant_of_id: string | null }>(db, "digital_materials", "variant_of_id", [
          { col: "id", op: "eq", value: data.variantOfId },
          { col: "tutor_id", op: "eq", value: tutorId },
        ]),
        selectRowsOrEmpty<{ id: string }>(db, "digital_materials", "id", [
          { col: "variant_of_id", op: "eq", value: data.materialId },
        ]),
      ]);
      if (!target[0] || target[0].variant_of_id || children.length > 0) {
        throw new Error("Formats can only link one level deep.");
      }
    }
    const { error } = await db
      .from<Row>("digital_materials")
      .update({
        variant_of_id: data.variantOfId,
        variant_label: data.variantOfId ? data.label || null : null,
      })
      .eq("id", data.materialId)
      .eq("tutor_id", tutorId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
