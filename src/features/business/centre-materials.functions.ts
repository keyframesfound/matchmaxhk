import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import {
  centreMaterialCards,
  type CentreMaterialCard,
  type CentreMaterialRow,
} from "./centre-materials";

/**
 * #815 §2.4: the public Study Materials tab of a Partner Centre channel.
 * Read-only; checkout stays on the #784 goods rails at /notes/<slug>.
 */
export const getCentreMaterials = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ orgSlug: z.string().trim().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }): Promise<CentreMaterialCard[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id, status")
      .eq("slug", data.orgSlug)
      .maybeSingle();
    if (orgError) throw new Error(orgError.message);
    // Only a staff-reviewed, live centre has a public channel at all.
    if (!org || org.status !== "active") return [];

    const { data: rows, error } = await supabaseAdmin
      .from("digital_materials" as never)
      .select(
        "id, slug, title, price_hkd, material_type, subject_tag, curriculum_tag, status, listing_kind, organization_id, sold_count, view_count",
      )
      .eq("organization_id", org.id)
      .eq("status", "published")
      .eq("listing_kind", "digital_file")
      .order("sold_count", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);

    return centreMaterialCards((rows ?? []) as unknown as CentreMaterialRow[]);
  });

/**
 * Organisations the signed-in user may publish as: active owner or admin
 * membership. Used by the notes editor's optional "Publish as" select.
 */
export const listSellerOrganisations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: memberships, error } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id, role, status")
      .eq("user_id", context.userId)
      .eq("status", "active");
    if (error) throw new Error(error.message);

    const orgIds = ((memberships ?? []) as Array<{ organization_id: string; role: string }>)
      .filter((m) => m.role === "owner" || m.role === "admin")
      .map((m) => m.organization_id);
    if (orgIds.length === 0) return [];

    const { data: orgs, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id, name, slug, status")
      .in("id", orgIds)
      .eq("status", "active")
      .order("name", { ascending: true });
    if (orgError) throw new Error(orgError.message);

    return ((orgs ?? []) as Array<{ id: string; name: string; slug: string }>).map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
    }));
  });
