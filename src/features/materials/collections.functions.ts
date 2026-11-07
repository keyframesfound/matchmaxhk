import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { selectRows, selectRowsOrEmpty, type Row } from "@/features/cases/desk-db";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { contactFilterError } from "@/lib/contact-filter";

/**
 * #556: Collections only organise a seller's Materials tab. Nothing here has a
 * price, and nothing can reach checkout.
 */

export type MaterialCollection = { id: string; name: string };

const COLLECTION_NAME_MAX = 60;

async function myTutorId(db: ReturnType<typeof asAdminDb>, userId: string): Promise<string> {
  const rows = await selectRows<{ id: string }>(db, "tutors", "id", [
    { col: "user_id", op: "eq", value: userId },
  ]);
  if (!rows[0]) throw new Error("Only sellers with a card have collections.");
  return rows[0].id;
}

export const getCollectionPicker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ materialId: z.string().uuid().nullable() }).parse(input),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ collections: MaterialCollection[]; selected: string | null }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = asAdminDb(supabaseAdmin);
      const owners = await selectRows<{ id: string }>(db, "tutors", "id", [
        { col: "user_id", op: "eq", value: context.userId },
      ]);
      const tutorId = owners[0]?.id;
      if (!tutorId) return { collections: [], selected: null };
      const [collections, materials] = await Promise.all([
        selectRowsOrEmpty<MaterialCollection>(db, "material_collections", "id, name", [
          { col: "tutor_id", op: "eq", value: tutorId },
        ]),
        data.materialId
          ? selectRowsOrEmpty<{ collection_id: string | null }>(
              db,
              "digital_materials",
              "collection_id",
              [
                { col: "id", op: "eq", value: data.materialId },
                { col: "tutor_id", op: "eq", value: tutorId },
              ],
            )
          : Promise.resolve([]),
      ]);
      return { collections, selected: materials[0]?.collection_id ?? null };
    },
  );

export const createCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z
          .string()
          .trim()
          .min(1)
          .max(COLLECTION_NAME_MAX)
          .superRefine((text, ctx) => {
            const error = contactFilterError(text);
            if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
          }),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<MaterialCollection> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutorId = await myTutorId(db, context.userId);
    const { data: created, error } = await db
      .from<MaterialCollection>("material_collections")
      .insert({ tutor_id: tutorId, name: data.name })
      .select("id, name")
      .single();
    if (error) {
      const existing = await selectRows<MaterialCollection>(
        db,
        "material_collections",
        "id, name",
        [{ col: "tutor_id", op: "eq", value: tutorId }],
      );
      const match = existing.find((c) => c.name.toLowerCase() === data.name.toLowerCase());
      if (match) return match;
      throw new Error(error.message);
    }
    return created;
  });

export const setMaterialCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ materialId: z.string().uuid(), collectionId: z.string().uuid().nullable() })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutorId = await myTutorId(db, context.userId);
    if (data.collectionId) {
      const owned = await selectRows<{ id: string }>(db, "material_collections", "id", [
        { col: "id", op: "eq", value: data.collectionId },
        { col: "tutor_id", op: "eq", value: tutorId },
      ]);
      if (!owned[0]) throw new Error("Collection not found.");
    }
    const { error } = await db
      .from<Row>("digital_materials")
      .update({ collection_id: data.collectionId })
      .eq("id", data.materialId)
      .eq("tutor_id", tutorId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
