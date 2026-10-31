import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  buildPriceGuide,
  type ComparableListing,
  type PriceGuide,
} from "@/features/materials/price-guide";

/**
 * Notes upload v2: the price-guide data for the upload form. Reads the
 * PUBLISHED notes-kind listings (price + classification only, the same
 * public surface the shop already shows) and builds the suggested range
 * with price-guide.ts. Public read; no private columns leave the server.
 */

const Input = z.object({
  materialType: z.enum(["notes", "mock", "exemplar", "flashcards"]),
  curriculumTag: z.string().trim().max(40).nullish(),
  subjectTag: z.string().trim().max(160).nullish(),
  subcategory: z.string().trim().max(40).nullish(),
  pageCount: z.number().int().min(0).max(10_000).nullish(),
  excludeId: z.string().uuid().nullish(),
});

type Row = {
  id: string;
  slug: string | null;
  title: string;
  price_hkd: number | string;
  material_type: string;
  curriculum_tag: string | null;
  subject_tag: string | null;
  subcategory?: string | null;
  page_count: number | null;
};

export const getNotePriceGuide = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<PriceGuide> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const base =
      "id, slug, title, price_hkd, material_type, curriculum_tag, subject_tag, page_count";
    const run = (columns: string) =>
      db
        .from<Row>("digital_materials")
        .select(`${columns}, tutors!inner(is_published)`)
        .eq("status", "published")
        .eq("tutors.is_published", true)
        .eq("material_type", data.materialType)
        .limit(1000);
    let result = await run(`${base}, subcategory`);
    if (result.error?.code === "42703") result = await run(base);
    const rows = result.error ? [] : (result.data ?? []);
    const pool: ComparableListing[] = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      priceHkd: Number(row.price_hkd ?? 0),
      materialType: row.material_type,
      curriculumTag: row.curriculum_tag ?? "",
      subjectTag: row.subject_tag,
      subcategory: row.subcategory ?? null,
      pageCount: row.page_count,
    }));
    return buildPriceGuide(
      {
        materialType: data.materialType,
        curriculumTag: data.curriculumTag,
        subjectTag: data.subjectTag,
        subcategory: data.subcategory,
        pageCount: data.pageCount,
        excludeId: data.excludeId,
      },
      pool,
    );
  });
