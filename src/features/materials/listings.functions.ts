import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { computeFolderAdjustedPrice } from "@/features/materials/lifecycle";
import {
  mapPublicNote,
  PUBLIC_NOTE_COLUMNS,
  PUBLIC_NOTE_TUTOR_JOIN,
  type PublicNote,
} from "@/features/materials/notes.functions";

/**
 * #392: the public read path for the SHOP kinds (topic folders, video /
 * general courses) on top of the existing note read. Every reader runs
 * under the SERVICE ROLE, so the publish gate the RLS policy would enforce
 * (material status='published' AND tutors.is_published=true) is restated
 * explicitly on EVERY query (PUBLIC_NOTE_COLUMNS precedent) — and kind
 * payloads are whitelisted just as hard: the public path NEVER carries
 * course_lessons.video_url / pdf_path (embeds and files unlock only for
 * buyers with a delivered order, via getCourseAccess).
 */

export type PublicFolderChild = {
  id: string;
  slug: string | null;
  title: string;
  priceHkd: number;
  coverImagePath: string | null;
  materialType: string;
};

export type PublicListingLesson = {
  id: string;
  position: number;
  title: string;
  /** 'youtube' | 'vimeo' | null — the PROVIDER only, never the raw URL. */
  videoProvider: string | null;
  hasPdf: boolean;
};

export type PublicListing = {
  listing: PublicNote;
  /** folder → published children ordered by position; course → lesson meta. */
  children: PublicFolderChild[] | null;
  lessons: PublicListingLesson[] | null;
};

const LISTING_CHILD_COLUMNS =
  "position, child:digital_materials!child_material_id(id, slug, title, price_hkd, cover_image_path, material_type, status)";

type FolderItemRow = {
  position: number;
  child: {
    id: string;
    slug: string | null;
    title: string;
    price_hkd: number | string;
    cover_image_path: string | null;
    material_type: string;
    status: string;
  } | null;
};

const LISTING_LESSON_COLUMNS = "id, position, title, video_provider, pdf_path";

type LessonRow = {
  id: string;
  position: number;
  title: string;
  video_provider: string | null;
  pdf_path: string | null;
};

/**
 * The public shop listing by slug (or id fallback, matching getPublicNote):
 * the listing row plus its kind payload. Returns null for anything not
 * published (404 on the detail route).
 */
export const getPublicListing = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ slug: z.string().trim().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }): Promise<PublicListing | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const isUuid = /^[0-9a-f-]{36}$/i.test(data.slug);
    const { data: rows, error } = await db
      .from<Record<string, unknown>>("digital_materials")
      .select(`${PUBLIC_NOTE_COLUMNS}, ${PUBLIC_NOTE_TUTOR_JOIN}`)
      .eq("status", "published")
      .eq("tutors.is_published", true)
      .eq(isUuid ? "id" : "slug", data.slug)
      .limit(1);
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    if (!row) return null;
    const listing = mapPublicNote(row);
    if (!listing) return null;

    if (listing.materialType === "topic_folder") {
      const { data: items, error: itemsError } = await db
        .from<FolderItemRow>("topic_folder_items")
        .select(LISTING_CHILD_COLUMNS)
        .eq("folder_id", listing.id)
        .order("position", { ascending: true });
      if (itemsError) throw new Error(itemsError.message);
      const children = (items ?? [])
        .map((item) => {
          const child = item.child;
          if (!child || child.status !== "published") return null;
          return {
            id: child.id,
            slug: typeof child.slug === "string" ? child.slug : null,
            title: child.title,
            priceHkd: Number(child.price_hkd ?? 0),
            coverImagePath:
              typeof child.cover_image_path === "string" ? child.cover_image_path : null,
            materialType: child.material_type,
          };
        })
        .filter((c): c is PublicFolderChild => c !== null);
      return { listing, children, lessons: null };
    }

    if (listing.materialType === "video_course" || listing.materialType === "general_course") {
      const { data: lessons, error: lessonsError } = await db
        .from<LessonRow>("course_lessons")
        .select(LISTING_LESSON_COLUMNS)
        .eq("material_id", listing.id)
        .order("position", { ascending: true });
      if (lessonsError) throw new Error(lessonsError.message);
      return {
        listing,
        children: null,
        lessons: (lessons ?? []).map((lesson) => ({
          id: lesson.id,
          position: Number(lesson.position),
          title: lesson.title,
          videoProvider:
            lesson.video_provider === "youtube" || lesson.video_provider === "vimeo"
              ? lesson.video_provider
              : null,
          hasPdf: Boolean(lesson.pdf_path),
        })),
      };
    }

    return { listing, children: null, lessons: null };
  });

/**
 * Buyer-facing folder price quote (proration): the buyer's DELIVERED orders
 * on the folder's published children (paid or granted — grants carry
 * gross 0) are subtracted from the bulk price, floored at 0. Signed-in
 * buyers only; the detail page renders bulk + savings for guests.
 */
export const getFolderPriceQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ folderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const { data: folder } = await db
      .from<{ id: string; price_hkd: number; status: string; tutor_id: string }>(
        "digital_materials",
      )
      .select("id, price_hkd, status, tutor_id")
      .eq("id", data.folderId)
      .eq("material_type", "topic_folder")
      .maybeSingle();
    if (!folder || folder.status !== "published") {
      throw new Error("This folder is not available right now.");
    }
    const { data: tutor } = await db
      .from<{ is_published: boolean }>("tutors")
      .select("is_published")
      .eq("id", folder.tutor_id)
      .maybeSingle();
    if (!tutor?.is_published) {
      throw new Error("This folder is not available right now.");
    }

    const { data: items } = await db
      .from<{ child_material_id: string }>("topic_folder_items")
      .select("child_material_id")
      .eq("folder_id", folder.id);
    const childIds = (items ?? []).map((item) => item.child_material_id);
    if (childIds.length === 0) {
      return {
        bulk: Number(folder.price_hkd),
        ownedSum: 0,
        adjusted: Number(folder.price_hkd),
        ownedChildren: [] as Array<{ id: string; title: string; slug: string | null }>,
      };
    }

    const { data: childRows } = await db
      .from<{ id: string; title: string; slug: string | null; status: string }>("digital_materials")
      .select("id, title, slug, status")
      .in("id", childIds)
      .eq("status", "published");
    const publishedChildren = childRows ?? [];

    const { data: ownedOrders } = await db
      .from<{ material_id: string; gross_hkd: number }>("material_orders")
      .select("material_id, gross_hkd")
      .eq("buyer_account_id", context.userId)
      .eq("status", "delivered")
      .in("material_id", childIds);

    const paidGross = (ownedOrders ?? []).map((order) => Number(order.gross_hkd));
    const { ownedSum, adjusted } = computeFolderAdjustedPrice({
      bulkHkd: Number(folder.price_hkd),
      paidChildGross: paidGross,
    });
    const ownedIds = new Set((ownedOrders ?? []).map((order) => order.material_id));
    return {
      bulk: Number(folder.price_hkd),
      ownedSum,
      adjusted,
      ownedChildren: publishedChildren
        .filter((child) => ownedIds.has(child.id))
        .map((child) => ({ id: child.id, title: child.title, slug: child.slug })),
    };
  });
