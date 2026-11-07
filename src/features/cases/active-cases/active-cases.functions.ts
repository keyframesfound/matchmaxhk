/**
 * Issues #633 + #635: Active Cases on profiles. The projection in active-cases.ts
 * runs here, so public visitors only ever receive masked Tier 1 fields. No phone,
 * address, fee ledger or child sub-profile data is selected at all.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import {
  projectActiveCases,
  visibilityKey,
  type ActiveCaseRow,
  type ActiveCasesProjection,
  type PartyVisibility,
  type ProfileSide,
} from "@/features/cases/active-cases/active-cases";

const SubjectSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("tutor"), tutorCode: z.string().trim().min(1).max(40) }),
  z.object({ kind: z.literal("handle"), handle: z.string().trim().min(1).max(60) }),
  z.object({ kind: z.literal("centre"), slug: z.string().trim().min(1).max(120) }),
]);
export type ActiveCasesSubject = z.infer<typeof SubjectSchema>;

const CASE_COLUMNS =
  "id, case_code, created_at, sor_status, sor_status_at, case_type, organisation_id, subjects, exam_system, student_level, mode, district, hourly_rate_hkd, rate_unit, learner_nickname, parent_id, matched_tutor_id";

type CaseRow = {
  id: string;
  case_code: string;
  created_at: string;
  sor_status: string | null;
  sor_status_at: string | null;
  case_type: string | null;
  organisation_id: string | null;
  subjects: string[] | null;
  exam_system: string | null;
  student_level: string | null;
  mode: string | null;
  district: string | null;
  hourly_rate_hkd: number | string | null;
  rate_unit: string | null;
  learner_nickname: string | null;
  parent_id: string | null;
  matched_tutor_id: string | null;
};

type TutorRow = {
  id: string;
  user_id: string | null;
  tutor_code: string | null;
  display_name: string | null;
};

type ResolvedProfile = {
  side: ProfileSide;
  ownerUserId: string | null;
  cases: CaseRow[];
};

const EMPTY_PROJECTION: ActiveCasesProjection = {
  activeCount: 0,
  pastCount: 0,
  recent45d: false,
  hiddenCount: 0,
  active: [],
  past: [],
};

const casesWhere = (db: Db, col: string, value: string) =>
  selectRows<CaseRow>(db, "tutoring_cases", CASE_COLUMNS, [{ col, op: "eq", value }]);

async function resolveProfile(
  db: Db,
  subject: ActiveCasesSubject,
): Promise<ResolvedProfile | null> {
  if (subject.kind === "tutor") {
    const tutors = await selectRows<TutorRow & { is_published: boolean }>(
      db,
      "tutors",
      "id, user_id, tutor_code, display_name, is_published",
      [{ col: "tutor_code", op: "eq", value: subject.tutorCode }],
    );
    const tutor = tutors[0];
    if (!tutor?.is_published) return null;
    return {
      side: "tutor",
      ownerUserId: tutor.user_id,
      cases: await casesWhere(db, "matched_tutor_id", tutor.id),
    };
  }
  if (subject.kind === "centre") {
    const orgs = await selectRows<{ id: string; status: string }>(
      db,
      "organizations",
      "id, status",
      [{ col: "slug", op: "eq", value: subject.slug }],
    );
    if (orgs[0]?.status !== "active") return null;
    return {
      side: "centre",
      ownerUserId: null,
      cases: await casesWhere(db, "organisation_id", orgs[0].id),
    };
  }
  const profiles = await selectRows<{ id: string }>(db, "profiles", "id", [
    { col: "handle", op: "eq", value: subject.handle },
  ]);
  const profile = profiles[0];
  if (!profile) return null;
  const tutors = await selectRows<TutorRow>(db, "tutors", "id, user_id, tutor_code, display_name", [
    { col: "user_id", op: "eq", value: profile.id },
  ]);
  const tutorCases = tutors[0] ? await casesWhere(db, "matched_tutor_id", tutors[0].id) : [];
  // A dual-role account's channel leads with Teaching when it holds a tutor card.
  return tutorCases.length > 0
    ? { side: "tutor", ownerUserId: profile.id, cases: tutorCases }
    : {
        side: "parent",
        ownerUserId: profile.id,
        cases: await casesWhere(db, "parent_id", profile.id),
      };
}

async function toRows(db: Db, cases: CaseRow[]): Promise<ActiveCaseRow[]> {
  const tutorIds = [...new Set(cases.flatMap((c) => c.matched_tutor_id ?? []))];
  const parentIds = [...new Set(cases.flatMap((c) => c.parent_id ?? []))];
  const tutors = tutorIds.length
    ? await selectRows<TutorRow>(db, "tutors", "id, user_id, tutor_code, display_name", [
        { col: "id", op: "in", value: tutorIds },
      ])
    : [];
  const parents = parentIds.length
    ? await selectRows<{ id: string; handle: string | null }>(db, "profiles", "id, handle", [
        { col: "id", op: "in", value: parentIds },
      ])
    : [];
  const tutorById = new Map(tutors.map((t) => [t.id, t]));
  const handleById = new Map(parents.map((p) => [p.id, p.handle]));
  return cases.map((c) => {
    const tutor = c.matched_tutor_id ? tutorById.get(c.matched_tutor_id) : undefined;
    return {
      id: c.id,
      caseCode: c.case_code,
      createdAt: c.created_at,
      sorStatus: c.sor_status,
      caseType: c.case_type,
      organisationId: c.organisation_id,
      subjects: c.subjects ?? [],
      examSystem: c.exam_system,
      studentLevel: c.student_level,
      mode: c.mode,
      district: c.district,
      hourlyRateHkd: c.hourly_rate_hkd === null ? null : Number(c.hourly_rate_hkd),
      rateUnit: c.rate_unit,
      learnerNickname: c.learner_nickname,
      endedAt: c.sor_status_at,
      parentUserId: c.parent_id,
      parentHandle: c.parent_id ? (handleById.get(c.parent_id) ?? null) : null,
      tutorUserId: tutor?.user_id ?? null,
      tutorCode: tutor?.tutor_code ?? null,
      tutorName: tutor?.display_name ?? null,
    };
  });
}

async function loadVisibility(db: Db, caseIds: string[]): Promise<Map<string, PartyVisibility>> {
  if (caseIds.length === 0) return new Map();
  const rows = await selectRows<{
    case_id: string;
    user_id: string;
    show_on_public_profile: boolean;
    mask_rate: boolean;
    mask_student_name: boolean;
    mask_fine_district: boolean;
  }>(
    db,
    "case_party_visibility",
    "case_id, user_id, show_on_public_profile, mask_rate, mask_student_name, mask_fine_district",
    [{ col: "case_id", op: "in", value: caseIds }],
  );
  return new Map(
    rows.map((row) => [
      visibilityKey(row.case_id, row.user_id),
      {
        show: row.show_on_public_profile,
        maskRate: row.mask_rate,
        maskStudent: row.mask_student_name,
        maskDistrict: row.mask_fine_district,
      },
    ]),
  );
}

async function buildProjection(
  subject: ActiveCasesSubject,
  viewerId: string | null,
): Promise<ActiveCasesProjection> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = asAdminDb(supabaseAdmin);
  const profile = await resolveProfile(db, subject);
  if (!profile) return EMPTY_PROJECTION;
  const rows = await toRows(db, profile.cases);
  const visibility = await loadVisibility(
    db,
    rows.map((row) => row.id),
  );
  return projectActiveCases(rows, visibility, profile, {
    ownerView: viewerId !== null && viewerId === profile.ownerUserId,
    now: new Date(),
  });
}

export const getPublicActiveCases = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => SubjectSchema.parse(input))
  .handler(({ data }): Promise<ActiveCasesProjection> => buildProjection(data, null));

/** Owner view: hidden cards and settings, only when the caller owns the profile. */
export const getMyActiveCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubjectSchema.parse(input))
  .handler(({ context, data }): Promise<ActiveCasesProjection> =>
    buildProjection(data, context.userId),
  );

export const saveCasePrivacy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        show: z.boolean(),
        maskRate: z.boolean(),
        maskStudent: z.boolean(),
        maskDistrict: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<void> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const cases = await selectRows<{ parent_id: string | null; matched_tutor_id: string | null }>(
      db,
      "tutoring_cases",
      "parent_id, matched_tutor_id",
      [{ col: "id", op: "eq", value: data.caseId }],
    );
    const c = cases[0];
    if (!c) throw new Error("Case not found");
    const tutors = c.matched_tutor_id
      ? await selectRows<{ user_id: string | null }>(db, "tutors", "user_id", [
          { col: "id", op: "eq", value: c.matched_tutor_id },
        ])
      : [];
    if (c.parent_id !== context.userId && tutors[0]?.user_id !== context.userId) {
      throw new Error("Only a party to this case can change its privacy settings.");
    }
    const { error } = await supabaseAdmin.from("case_party_visibility" as never).upsert(
      {
        case_id: data.caseId,
        user_id: context.userId,
        show_on_public_profile: data.show,
        mask_rate: data.maskRate,
        mask_student_name: data.maskStudent,
        mask_fine_district: data.maskDistrict,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "case_id,user_id" },
    );
    if (error) throw new Error(error.message);
  });
