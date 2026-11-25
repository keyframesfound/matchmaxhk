import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db, selectRowsOrEmpty } from "@/features/cases/desk-db";
import type { HourlyOpenHours } from "@/features/tutors/availability-grid-model";
import { emptyHourlyOpenHours } from "@/features/tutors/availability-grid-model";
import { computeOccupiedHoursByTutor } from "@/features/tutors/availability-occupancy.functions";
import { resolvePublicOpenHours } from "@/features/tutors/queries";
import {
  selectPinnedProofPosts,
  type ChannelProofPost,
} from "@/features/channels/channel-proof-posts";

/**
 * Issue #548: Unified Channel Profile. Public channel data for
 * /u/[handle] — identity, live stats (verified hours / active students /
 * published materials / reviews), the Pro-Bono & Impact card, centre
 * affiliations and the public slice of the #545 Education CV.
 *
 * Privacy invariants: no phone, email, FPS or child sub-profile data ever
 * leaves these functions; student identity never appears in stats (counts
 * only); pro-bono REQUESTS are private (they surface on the tutor's case
 * lead card, never here).
 */

export type ChannelStats = {
  verifiedHours: number;
  activeStudents: number;
  materialsCount: number;
  reviewsCount: number;
  avgRating: number | null;
};

/**
 * #712 AC-1: the read-only weekly grid on the channel. Open hours come from the
 * same `resolvePublicOpenHours` derivation the public tutor page uses; Occupied
 * cells come from the same batched booking read. Both carry day/hour integers
 * only, so no student, lesson or earnings detail can appear on the channel.
 */
export type ChannelAvailability = {
  openHours: HourlyOpenHours;
  occupiedHours: HourlyOpenHours;
  timezone: string | null;
};

export type ChannelProfileData = {
  found: boolean;
  isOwner: boolean;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: string | null;
  tutorCode: string | null;
  headline: string | null;
  badge: string | null;
  blueTick: boolean;
  isPublished: boolean;
  subjects: string[];
  hourlyRate: number | null;
  minHourlyRateHkd: number | null;
  acceptingStudents: boolean;
  proBono: {
    acceptsProBono: boolean;
    acceptsReducedRate: boolean;
    reducedHourlyRateHkd: number | null;
    maxSlots: number;
    /** Active pro-bono cases (matched, not closed) with a private request. */
    activeProBonoCases: number;
  } | null;
  stats: ChannelStats | null;
  /** #712: up to three achievements that carry a public proof photo. */
  proofPosts: ChannelProofPost[];
  /** #712: weekly Open/Occupied grid; null when the profile has no tutor card. */
  availability: ChannelAvailability | null;
  affiliations: {
    id: string;
    centreName: string;
    centreSlug: string;
    roleType: string;
    /**
     * #548 P2 audit: an `alumni_student` affiliation is a self-declared claim.
     * Nothing verifies it, so the channel must never render it as a confirmed
     * centre relationship. The centre can still confirm it later via
     * `decideAffiliation`, which clears the marker.
     */
    selfDeclared: boolean;
  }[];
  birthdayMonthDay: string | null;
  publicRecords: {
    id: string;
    category: string;
    institution_or_issuer: string;
    title_or_program: string;
    start_year: number | null;
    end_year: number | null;
    is_current: boolean;
    grades_or_results: string | null;
  }[];
};

/**
 * Is this centre affiliation a self-declared claim rather than a centre
 * decision? Only `alumni_student` rows qualify, and only while nobody but the
 * claimant has decided them:
 *
 * - rows written by `requestAffiliation` after this fix carry `decided_by: null`
 *   (no decision was taken at all);
 * - legacy rows stamped `decided_by: <the claimant>` on the auto-approve path
 *   are self-declared too — the claimant deciding their own row is not a
 *   centre decision;
 * - a centre approving it later writes the admin's id, which clears the marker.
 */
export function isSelfDeclaredAffiliation(input: {
  roleType: string;
  decidedBy: string | null;
  userId: string;
}): boolean {
  if (input.roleType !== "alumni_student") return false;
  return input.decidedBy === null || input.decidedBy === input.userId;
}

/**
 * A tutor card is public only when it is published, not locked by a ban and
 * its owner account is not banned. Same rule the search and centre-channel
 * surfaces apply, so a hidden card cannot be reached through /u/[handle].
 */
export function isChannelCardPublic(card: {
  isPublished: boolean | null;
  cardHiddenByBan: boolean | null;
  ownerAccountStatus: string | null;
}): boolean {
  return (
    card.isPublished === true &&
    card.cardHiddenByBan !== true &&
    card.ownerAccountStatus !== "banned"
  );
}

/**
 * #522: the opt-in 🎂 month/day badge is for logged-in viewers only — the
 * comment in `getChannelProfile` always said so, the code did not.
 */
export function visibleBirthdayMonthDay(input: {
  viewerId: string | null;
  showBirthdayPublic: boolean | null;
  dateOfBirth: string | null;
}): string | null {
  if (input.viewerId === null) return null;
  if (input.showBirthdayPublic !== true || !input.dateOfBirth) return null;
  return input.dateOfBirth.slice(5); // MM-DD; the year never leaves the server
}

async function tutorStats(db: Db, tutorId: string): Promise<ChannelStats> {
  const [hours, activeCases, materials, reviews] = await Promise.all([
    db
      .from<{ duration_hours: number | string }>("verified_hours_ledger")
      .select("duration_hours")
      .eq("tutor_id", tutorId)
      .eq("status", "verified_completed"),
    db
      .from<{ sor_status: string | null }>("tutoring_cases")
      .select("sor_status")
      .eq("matched_tutor_id", tutorId),
    db
      .from<{ id: string }>("digital_materials")
      .select("id")
      .eq("tutor_id", tutorId)
      .eq("status", "published"),
    db
      .from<{ rating: number }>("case_reviews")
      .select("rating")
      .eq("tutor_id", tutorId)
      .eq("direction", "parent_to_tutor")
      .eq("status", "visible"),
  ]);
  const verifiedHours = (hours.data ?? []).reduce((sum, r) => sum + Number(r.duration_hours), 0);
  const activeStudents = (activeCases.data ?? []).filter(
    (c) => c.sor_status !== null && c.sor_status !== "closed" && c.sor_status !== "replaced",
  ).length;
  const ratings = (reviews.data ?? []).map((r) => Number(r.rating));
  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;
  return {
    verifiedHours: Math.round(verifiedHours * 100) / 100,
    activeStudents,
    materialsCount: (materials.data ?? []).length,
    reviewsCount: ratings.length,
    avgRating,
  };
}

/**
 * The channel is a **public** page. It used to sit behind `requireSupabaseAuth`,
 * so a signed-out visitor — or a tutor opening their own link from WhatsApp —
 * got a thrown error that the page rendered as "Channel not found". A public
 * profile that 404s for the public is worse than useless: tutors conclude the
 * product is broken and cannot be onboarded.
 *
 * So the read is auth-optional: the bearer token is resolved when it is there
 * (to decide `isOwner`), and its absence is a normal state rather than an error.
 */
async function optionalChannelUserId(): Promise<string | null> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const header = getRequest()?.headers?.get("authorization");
    if (!header?.startsWith("Bearer ")) return null;
    const token = header.slice("Bearer ".length).trim();
    if (!token) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.auth.getUser(token);
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

export const getChannelProfile = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ handle: z.string().trim().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data }): Promise<ChannelProfileData> => {
    const viewerId = await optionalChannelUserId();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const notFound: ChannelProfileData = {
      found: false,
      isOwner: false,
      handle: data.handle,
      displayName: "",
      avatarUrl: null,
      joinedAt: null,
      tutorCode: null,
      headline: null,
      badge: null,
      blueTick: false,
      isPublished: false,
      subjects: [],
      hourlyRate: null,
      minHourlyRateHkd: null,
      acceptingStudents: true,
      proBono: null,
      stats: null,
      proofPosts: [],
      availability: null,
      affiliations: [],
      publicRecords: [],
      birthdayMonthDay: null,
    };

    const profiles = await selectRows<{
      id: string;
      handle: string | null;
      display_name: string | null;
      avatar_url: string | null;
      created_at: string;
      date_of_birth: string | null;
      show_birthday_public: boolean | null;
    }>(
      db,
      "profiles",
      "id, handle, display_name, avatar_url, created_at, date_of_birth, show_birthday_public",
      [{ col: "handle", op: "eq", value: data.handle.toLowerCase() }],
    );
    const profile = profiles[0];
    if (!profile) return notFound;

    const tutors = await selectRows<{
      id: string;
      tutor_code: string | null;
      headline: string | null;
      badge: string | null;
      subjects: string[] | null;
      hourly_rate: number | null;
      min_hourly_rate_hkd: number | null;
      is_published: boolean | null;
      is_accepting_students: boolean | null;
      accepts_pro_bono: boolean | null;
      accepts_reduced_rate: boolean | null;
      reduced_hourly_rate_hkd: number | null;
      pro_bono_max_slots: number | null;
      card_hidden_by_ban: boolean | null;
      owner_account_status: string | null;
      achievements: unknown;
      availability_grid: unknown;
      availability_grid_hourly: unknown;
      availability_grid_hourly_reviewed_at: string | null;
      timezone: string | null;
    }>(
      db,
      "tutors",
      "id, tutor_code, headline, badge, subjects, hourly_rate, min_hourly_rate_hkd, is_published, is_accepting_students, accepts_pro_bono, accepts_reduced_rate, reduced_hourly_rate_hkd, pro_bono_max_slots, card_hidden_by_ban, owner_account_status, achievements, availability_grid, availability_grid_hourly, availability_grid_hourly_reviewed_at, timezone",
      [{ col: "user_id", op: "eq", value: profile.id }],
    );
    const tutor = tutors[0] ?? null;

    /**
     * #548 P2 audit: an unpublished or banned card still served its headline,
     * rate and stats here, so a hidden card stayed reachable at /u/[handle]
     * even though search and the centre channel had already dropped it. A
     * profile with no tutor card at all (parent, staff, centre contact) is
     * unaffected — the channel is their only public page.
     */
    if (
      tutor &&
      viewerId !== profile.id &&
      !isChannelCardPublic({
        isPublished: tutor.is_published,
        cardHiddenByBan: tutor.card_hidden_by_ban,
        ownerAccountStatus: tutor.owner_account_status,
      })
    ) {
      return notFound;
    }

    /**
     * #548 regression, found on production 2026-11-22: this read selected
     * `tutors.blue_tick_verified`, a column that has never existed, so the
     * whole server function threw "column tutors.blue_tick_verified does not
     * exist". The page swallowed the error as "Channel not found." — for every
     * visitor, including the tutor opening their own link. The Blue Tick is
     * derived data (one staff-approved `tutor_grades` row), the same rule
     * Profile Strength uses, so it is computed here instead of selected.
     */
    const grades = tutor
      ? await selectRowsOrEmpty<{ status: string }>(db, "tutor_grades", "status", [
          { col: "tutor_id", op: "eq", value: tutor.id },
        ])
      : [];
    const blueTick = grades.some((g) => g.status === "approved");

    const stats = tutor ? await tutorStats(db, tutor.id) : null;

    /**
     * #712 AC-1: public proof posts. Only achievements with a published proof
     * photo qualify; `selectPinnedProofPosts` copies the four public fields
     * and nothing else.
     */
    const proofPosts = tutor ? selectPinnedProofPosts(tutor.achievements) : [];

    /**
     * #712 AC-1: the read-only weekly availability grid, derived exactly like
     * the public tutor page — base Open hours from the tutor's stored hourly
     * column (legacy fallback included), Occupied from confirmed bookings at
     * read time. The occupancy read degrades to base Open hours, never throws,
     * so a channel still renders when that source is unavailable.
     */
    let availability: ChannelAvailability | null = null;
    if (tutor) {
      const openHours = resolvePublicOpenHours({
        availability_grid_hourly: tutor.availability_grid_hourly,
        availability_grid_hourly_reviewed_at: tutor.availability_grid_hourly_reviewed_at,
        availability_grid: tutor.availability_grid,
      });
      let occupiedHours = emptyHourlyOpenHours();
      try {
        const occupied = await computeOccupiedHoursByTutor(db, [{ tutorId: tutor.id }]);
        occupiedHours = occupied.get(tutor.id) ?? occupiedHours;
      } catch (error) {
        console.warn(
          "[channel] occupancy read failed, showing base Open hours:",
          error instanceof Error ? error.message : error,
        );
      }
      availability = { openHours, occupiedHours, timezone: tutor.timezone };
    }

    // #548: live pro-bono slot usage = open cases with the private request.
    let activeProBonoCases = 0;
    if (tutor && (tutor.accepts_pro_bono || tutor.accepts_reduced_rate)) {
      const { data } = await db
        .from<{ id: string }>("tutoring_cases")
        .select("id")
        .eq("matched_tutor_id", tutor.id)
        .eq("pro_bono_request", true)
        .neq("sor_status", "closed")
        .neq("sor_status", "replaced");
      activeProBonoCases = (data ?? []).length;
    }

    const affils = tutor
      ? await selectRows<{
          id: string;
          user_id: string;
          role_type: string;
          decided_by: string | null;
          organizations: { name: string; slug: string } | null;
        }>(
          db,
          "centre_affiliations",
          "id, user_id, role_type, decided_by, organizations(name, slug)",
          [
            { col: "user_id", op: "eq", value: profile.id },
            { col: "status", op: "eq", value: "approved" },
          ],
        )
      : [];
    const { data: records } = await db
      .from<{
        id: string;
        category: string;
        institution_or_issuer: string;
        title_or_program: string;
        start_year: number | null;
        end_year: number | null;
        is_current: boolean;
        grades_or_results: string | null;
      }>("academic_records")
      .select(
        "id, category, institution_or_issuer, title_or_program, start_year, end_year, is_current, grades_or_results",
      )
      .eq("owner_user_id", profile.id)
      .eq("child_profile_id", null)
      .eq("visibility", "public_tutor")
      .order("start_year", { ascending: false })
      .limit(50);

    return {
      found: true,
      isOwner: viewerId !== null && viewerId === profile.id,
      handle: profile.handle ?? data.handle,
      displayName: profile.display_name ?? data.handle,
      avatarUrl: profile.avatar_url,
      joinedAt: profile.created_at,
      tutorCode: tutor?.tutor_code ?? null,
      headline: tutor?.headline ?? null,
      badge: tutor?.badge ?? null,
      blueTick,
      isPublished: tutor?.is_published === true,
      subjects: tutor?.subjects ?? [],
      hourlyRate: tutor?.hourly_rate ?? null,
      minHourlyRateHkd: tutor?.min_hourly_rate_hkd ?? null,
      acceptingStudents: tutor?.is_accepting_students ?? true,
      proBono:
        tutor && (tutor.accepts_pro_bono || tutor.accepts_reduced_rate)
          ? {
              acceptsProBono: tutor.accepts_pro_bono === true,
              acceptsReducedRate: tutor.accepts_reduced_rate === true,
              reducedHourlyRateHkd: tutor.reduced_hourly_rate_hkd ?? null,
              maxSlots: tutor.pro_bono_max_slots ?? 0,
              activeProBonoCases,
            }
          : null,
      stats,
      proofPosts,
      availability,
      // #522: opt-in 🎂 month/day badge, logged-in viewers only; the year
      // and exact age never leave the server.
      birthdayMonthDay: visibleBirthdayMonthDay({
        viewerId,
        showBirthdayPublic: profile.show_birthday_public,
        dateOfBirth: profile.date_of_birth,
      }),
      affiliations: affils
        .filter((a) => a.organizations)
        .map((a) => ({
          id: a.id,
          centreName: a.organizations!.name,
          centreSlug: a.organizations!.slug,
          roleType: a.role_type,
          selfDeclared: isSelfDeclaredAffiliation({
            roleType: a.role_type,
            decidedBy: a.decided_by ?? null,
            userId: a.user_id,
          }),
        })),
      publicRecords: records ?? [],
    };
  });

/** Owner settings: the Impact & Pro-Bono preferences (#548 C1). */
export const setProBonoPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        acceptsProBono: z.boolean(),
        acceptsReducedRate: z.boolean(),
        reducedHourlyRateHkd: z.number().int().min(0).max(5000).nullish(),
        maxSlots: z.number().int().min(0).max(10),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { error } = await db
      .from("tutors")
      .update({
        accepts_pro_bono: data.acceptsProBono,
        accepts_reduced_rate: data.acceptsReducedRate,
        reduced_hourly_rate_hkd: data.acceptsReducedRate
          ? (data.reducedHourlyRateHkd ?? null)
          : null,
        pro_bono_max_slots: data.maxSlots,
      })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Request a centre affiliation (#548 B1).
 *
 * `alumni_student` stays auto-visible but is **self-declared**: it is never
 * stamped as a centre decision (`decided_by`/`decided_at` stay null) and the
 * channel renders it as unconfirmed. The honest alternative — routing alumni
 * through `pending` — has no centre-side approval screen
 * (`listPendingAffiliations` has no UI), so it would bury every alumni claim
 * permanently instead of labelling it.
 */
export const requestAffiliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        centreSlug: z.string().trim().min(1).max(80),
        roleType: z.enum(["affiliated_tutor", "alumni_student"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean; status: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const orgs = await selectRows<{ id: string }>(db, "organizations", "id", [
      { col: "slug", op: "eq", value: data.centreSlug },
    ]);
    const centre = orgs[0];
    if (!centre) throw new Error("CENTRE_NOT_FOUND");
    const status = data.roleType === "alumni_student" ? "approved" : "pending";
    const { error } = await db.from("centre_affiliations").upsert(
      {
        user_id: context.userId,
        centre_id: centre.id,
        role_type: data.roleType,
        status,
        requested_by: context.userId,
        // No decision was taken: the claimant wrote their own alumni claim.
        // A centre approving it later (decideAffiliation) fills these in and
        // clears the self-declared marker on the channel.
        decided_by: null,
        decided_at: null,
      },
      { onConflict: "user_id,centre_id" },
    );
    if (error) throw new Error(error.message);

    // #561 AR-8: pending affiliated-tutor requests become an Action Required
    // item for the centre's admins; decideAffiliation resolves it.
    if (status === "pending") {
      try {
        const { emitDirectAction } = await import("@/features/cases/action-required.functions");
        const admins = await db
          .from<{ created_by: string }>("organizations")
          .select("created_by")
          .eq("id", centre.id)
          .limit(1);
        const recipients = new Set<string>();
        if (admins.data?.[0]?.created_by) recipients.add(admins.data[0].created_by);
        const { data: members } = await db
          .from<{ user_id: string | null }>("organization_members")
          .select("user_id")
          .eq("organization_id", centre.id)
          .in("status", ["active", "pending"]);
        for (const m of members ?? []) if (m.user_id) recipients.add(m.user_id);
        for (const recipient of recipients) {
          if (recipient === context.userId) continue;
          await emitDirectAction(db, "action.admin_task", recipient, {
            context: "system",
            entity_id: `affil:${centre.id}`,
            admin_title: "Centre affiliation request",
            admin_title_zh: "補習中心關聯申請",
            admin_body:
              "A tutor requested affiliation with your centre. Review it in the workspace.",
            urgency: "medium",
            link: "/business",
            cta_label: "Review request",
            cta_label_zh: "查看申請",
          });
        }
      } catch (arError) {
        console.warn("[affiliations] review action failed:", arError);
      }
    }
    return { ok: true, status };
  });

/** Centre-side decisions (#548 approve / #550 workspace gate). */
export const decideAffiliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ affiliationId: z.string().uuid(), approve: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const rows = await selectRows<{ id: string; centre_id: string; status: string }>(
      db,
      "centre_affiliations",
      "id, centre_id, status",
      [{ col: "id", op: "eq", value: data.affiliationId }],
    );
    const affil = rows[0];
    if (!affil || affil.status !== "pending") throw new Error("NOT_PENDING");
    await assertCentreAdmin(db, context.userId, affil.centre_id);
    const now = new Date().toISOString();
    const { error } = await db
      .from("centre_affiliations")
      .update({
        status: data.approve ? "approved" : "withdrawn",
        decided_by: context.userId,
        decided_at: now,
      })
      .eq("id", affil.id);
    if (error) throw new Error(error.message);
    // #561 AR-8: the decision resolves the centre's review actions.
    try {
      const { completeActionsFor } = await import("@/features/cases/action-required.functions");
      await completeActionsFor(db, "admin_task", `affil:${affil.centre_id}`);
    } catch (arError) {
      console.warn("[affiliations] action completion failed:", arError);
    }
    return { ok: true };
  });

/** Pending affiliation queue for a centre admin (#548/#550). */
export const listPendingAffiliations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ centreId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await assertCentreAdmin(db, context.userId, data.centreId);
    const rows = await selectRows<{
      id: string;
      role_type: string;
      created_at: string;
      profiles: { display_name: string | null; handle: string | null } | null;
    }>(
      db,
      "centre_affiliations",
      "id, role_type, created_at, profiles(display_name, handle)",
      [
        { col: "centre_id", op: "eq", value: data.centreId },
        { col: "status", op: "eq", value: "pending" },
      ],
      { col: "created_at", asc: true },
    );
    return rows.map((r) => ({
      id: r.id,
      roleType: r.role_type,
      createdAt: r.created_at,
      name: r.profiles?.display_name ?? r.profiles?.handle ?? "(user)",
    }));
  });

/**
 * Is this user an owner/admin of the centre (workspace member active, or
 * the organization creator)? #550 staff table first, creator fallback.
 */
export async function assertCentreAdmin(db: Db, userId: string, centreId: string): Promise<void> {
  const members = await selectRows<{ role: string; status: string }>(
    db,
    "workspace_members",
    "role, status",
    [
      { col: "centre_id", op: "eq", value: centreId },
      { col: "user_id", op: "eq", value: userId },
    ],
  );
  const member = members[0];
  if (member && member.status === "active" && (member.role === "owner" || member.role === "admin"))
    return;
  const orgs = await selectRows<{ created_by: string }>(db, "organizations", "created_by", [
    { col: "id", op: "eq", value: centreId },
  ]);
  if (orgs[0]?.created_by === userId) return;
  throw new Error("Forbidden");
}

/** Study Materials tab: the tutor's published listings (no private data). */
export const getChannelMaterials = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ handle: z.string().trim().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const profiles = await selectRows<{ id: string }>(db, "profiles", "id", [
      { col: "handle", op: "eq", value: data.handle.toLowerCase() },
    ]);
    const profile = profiles[0];
    if (!profile) return [];
    const tutors = await selectRows<{ id: string }>(db, "tutors", "id", [
      { col: "user_id", op: "eq", value: profile.id },
    ]);
    if (!tutors[0]) return [];
    const rows = await selectRows<{
      id: string;
      title: string;
      price_hkd: number | null;
      material_type: string | null;
      subject: string | null;
      collection_id: string | null;
    }>(
      db,
      "digital_materials",
      "id, title, price_hkd, material_type, subject, collection_id",
      [
        { col: "tutor_id", op: "eq", value: tutors[0].id },
        { col: "status", op: "eq", value: "published" },
      ],
      { col: "created_at", asc: false, limit: 50 },
    );
    return rows;
  });

/** #556: the seller's collection names, for the Materials tab filter pills. */
export const getChannelCollections = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ handle: z.string().trim().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const profiles = await selectRows<{ id: string }>(db, "profiles", "id", [
      { col: "handle", op: "eq", value: data.handle.toLowerCase() },
    ]);
    if (!profiles[0]) return [];
    const tutors = await selectRows<{ id: string }>(db, "tutors", "id", [
      { col: "user_id", op: "eq", value: profiles[0].id },
    ]);
    if (!tutors[0]) return [];
    return selectRowsOrEmpty<{ id: string; name: string }>(db, "material_collections", "id, name", [
      { col: "tutor_id", op: "eq", value: tutors[0].id },
    ]);
  });

/** Reviews tab: published case reviews for the tutor. */
export const getChannelReviews = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ handle: z.string().trim().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const profiles = await selectRows<{ id: string }>(db, "profiles", "id", [
      { col: "handle", op: "eq", value: data.handle.toLowerCase() },
    ]);
    const profile = profiles[0];
    if (!profile) return [];
    const tutors = await selectRows<{ id: string }>(db, "tutors", "id", [
      { col: "user_id", op: "eq", value: profile.id },
    ]);
    if (!tutors[0]) return [];
    const { data: rows } = await db
      .from<{
        id: string;
        rating: number;
        comment: string | null;
        created_at: string;
        author_display_line: string | null;
      }>("case_reviews")
      .select("id, rating, comment, created_at, author_display_line")
      .eq("tutor_id", tutors[0].id)
      .eq("direction", "parent_to_tutor")
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .limit(50);
    return (rows ?? []).map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
      name: r.author_display_line,
    }));
  });
