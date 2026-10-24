import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { enforceCaseTierConsistency } from "@/features/cases/case-options";
import { buildCaseTitle as buildStructuredTitle } from "@/features/cases/case-title";
import {
  buildVerticalInsert,
  normalizeFunnelLevel,
  SECONDARY_BANDS,
  storedStudentLevel,
} from "@/features/cases/case-verticals";
import { FEE_TERMS_VERSION } from "@/features/legal/terms";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizeCaseFreeText } from "@/lib/contact-filter";
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from "@/lib/money";

/**
 * Issue #412 E — the centre (B2B) case-request path with 4-part Cap.57-safe
 * triage. Partner Organisations engage independent educators only: category
 * B (employment/staff recruitment) is hard-blocked, third-party/unsure and
 * the two Part-3 gates drop the request into `compliance_hold` for manual
 * staff re-screening before it can ever reach the tutor board. Everything
 * writes through the service-role client — org membership is verified
 * server-side, never trusted from the payload.
 */

export type CentreTriage = {
  engagementCategory: "independent_services" | "third_party" | "unsure";
  contractingEntity: "organisation_self" | "third_party";
  feeStructure: "hourly" | "per_session" | "revenue_split";
  feeAmount: string | null;
  feeOpenToCounter: boolean;
  premisesProvider: "organisation" | "educator" | "online_shared";
  scopeDescription: string;
  adminDutiesRequired: "no" | "yes" | "unsure";
  replacesVacancy: "no" | "yes";
  methodologyOwner: "educator" | "mutual" | "centre_controlled";
  otherClientsAllowed: "yes" | "no";
  substitutionAllowed: "yes" | "no" | "open";
};

export const CENTRE_BLOCK_MESSAGE =
  "MatchMax is an independent educator marketplace and does not provide staff or employment recruitment services.";

const CentreTriageInput = z.object({
  // "employment" is accepted by the parser purely so the hard block can
  // return the sanctioned modal message — it never becomes a case.
  engagementCategory: z.enum(["independent_services", "employment", "third_party", "unsure"]),
  contractingEntity: z.enum(["organisation_self", "third_party"]),
  feeStructure: z.enum(["hourly", "per_session", "revenue_split"]),
  feeAmount: z.string().trim().max(40).optional().nullable(),
  feeOpenToCounter: z.boolean(),
  premisesProvider: z.enum(["organisation", "educator", "online_shared"]),
  scopeDescription: z.string().trim().min(4, "Describe the course scope").max(300),
  adminDutiesRequired: z.enum(["no", "yes", "unsure"]),
  replacesVacancy: z.enum(["no", "yes"]),
  methodologyOwner: z.enum(["educator", "mutual", "centre_controlled"]),
  otherClientsAllowed: z.enum(["yes", "no"]),
  substitutionAllowed: z.enum(["yes", "no", "open"]),
});

export type CentreCasePayload = z.infer<typeof CentreCaseInput>;

const CentreCaseInput = z.object({
  orgId: z.string().uuid(),
  supportType: z.enum(["subject_tutoring", "admissions"]),
  academicLevel: z.enum(["Kindergarten", "Primary", "Secondary", "University"]),
  secondaryBand: z.enum(SECONDARY_BANDS).optional().nullable(),
  curriculum: z.string().trim().min(1).max(80),
  subjects: z.array(z.string().trim().min(1).max(120)).min(1).max(4),
  mode: z.enum(["online", "offline", "both"]),
  district: z.string().trim().max(80).optional().nullable(),
  budgetMin: z.number().int().min(0).max(100000).optional().nullable(),
  budgetMax: z.number().int().min(0).max(100000).optional().nullable(),
  budgetCurrency: z.enum(SUPPORTED_CURRENCIES).optional(),
  packageType: z.enum(["ongoing_1_5", "short_20", "pro_bono"]).default("ongoing_1_5"),
  studentCount: z.number().int().min(1).max(99).default(1),
  rateUnit: z.enum(["hr", "lesson", "month"]).default("hr"),
  notes: z.string().trim().max(500).optional().nullable(),
  triage: CentreTriageInput,
  feeAck: z.literal(true),
});

/**
 * #412 E routing. Exported for the vitest suite — the pure decision table is:
 *   employment category      → hard block (never reaches this fn as a case;
 *                              the client shows the modal and the server
 *                              rejects the literal)
 *   third_party / unsure     → compliance_hold
 *   third-party contracting  → compliance_hold
 *   admin duties yes/unsure  → compliance_hold
 *   vacancy replacement      → compliance_hold
 *   otherwise                → new (normal desk handling)
 */
export function centreTriageStatus(triage: {
  engagementCategory: CentreTriage["engagementCategory"] | "employment";
  contractingEntity: CentreTriage["contractingEntity"];
  adminDutiesRequired: CentreTriage["adminDutiesRequired"];
  replacesVacancy: CentreTriage["replacesVacancy"];
}): "new" | "compliance_hold" {
  // "employment" is defensive — the handler blocks it before this runs.
  if (triage.engagementCategory !== "independent_services") return "compliance_hold";
  if (triage.contractingEntity === "third_party") return "compliance_hold";
  if (triage.adminDutiesRequired !== "no") return "compliance_hold";
  if (triage.replacesVacancy === "yes") return "compliance_hold";
  return "new";
}

async function requireOrgMembership(userId: string, orgId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: membership, error } = await supabaseAdmin
    .from("organization_members")
    .select("id, role, status")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!membership || membership.status !== "active") {
    throw new Error("You are not an active member of this organization.");
  }
  const { data: org } = await supabaseAdmin
    .from("organizations")
    .select("id, name, legal_entity_name, status, br_number, rep_name, contact_phone")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) throw new Error("Organization not found.");
  // #412: only BR-reviewed (activated) partner orgs can engage educators —
  // pending orgs are still under staff review.
  if (org.status !== "active" || !org.br_number) {
    throw new Error(
      "Your organization is still under Business Registration review. Case requests open once your account is activated.",
    );
  }
  return org;
}

export const submitCentreCaseRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CentreCaseInput.parse(data))
  .handler(async ({ data, context }) => {
    const org = await requireOrgMembership(context.userId, data.orgId);

    // #412 Part 1 hard gate: staff/employee recruitment is rejected outright
    // with the sanctioned copy — no case row is created for it.
    if (data.triage.engagementCategory === "employment") {
      throw new Error(CENTRE_BLOCK_MESSAGE);
    }

    const tierConsistent = enforceCaseTierConsistency({
      supportType: data.supportType,
      academicLevel: data.academicLevel,
      curriculum: data.curriculum,
      subjects: data.subjects,
    });

    const storedTitle = buildStructuredTitle(
      {
        curriculum: tierConsistent.curriculum,
        subjects: tierConsistent.subjects,
        grade:
          storedStudentLevel(
            normalizeFunnelLevel(data.academicLevel),
            data.secondaryBand ?? null,
          ) ?? null,
      },
      "en",
    );

    const status = centreTriageStatus(data.triage);

    const insertRow = {
      title: storedTitle || tierConsistent.subjects[0] || "Centre request",
      description: sanitizeCaseFreeText(data.notes, 2000),
      subjects: tierConsistent.subjects,
      exam_system: tierConsistent.curriculum,
      student_level:
        storedStudentLevel(normalizeFunnelLevel(data.academicLevel), data.secondaryBand ?? null) ??
        "Unspecified",
      // Same vertical mapping as the parent path (tier + uni/K nulls).
      ...buildVerticalInsert({
        academicLevel: normalizeFunnelLevel(data.academicLevel),
        uniField: null,
        uniName: null,
        uniProgram: null,
        uniCourseCodes: null,
        kindergartenTopics: [],
      }),
      support_type: data.supportType,
      requester_type: "centre",
      organisation_id: org.id,
      tutor_background: "any",
      language_of_instruction: "either",
      mode: (data.mode === "offline"
        ? "in_person"
        : data.mode === "online"
          ? "online"
          : "either") as "in_person" | "online" | "either",
      district: data.district || null,
      sessions_per_week: 1,
      session_length_minutes: 60,
      preferred_gender: "any" as const,
      budget_min: data.budgetMin ?? null,
      budget_max: data.budgetMax ?? null,
      package_type: data.packageType,
      student_count: data.studentCount,
      rate_unit: data.rateUnit,
      budget_currency: data.budgetCurrency ?? DEFAULT_CURRENCY,
      // Centre identity: the BR-verified organisation is the customer of
      // record; contact fields carry the authorised representative.
      contact_name: org.rep_name ?? org.name,
      contact_phone: org.contact_phone ?? "",
      tags: [],
      sen_required: false,
      sen_categories: [],
      source: "website_centre",
      status,
      compliance_triage: { scope: "centre", ...data.triage },
      // Held requests never auto-publish; staff publish after re-screening.
      board_published_at: null,
    };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("tutoring_cases")
      .insert(insertRow)
      .select("id,case_code")
      .single();
    if (error) throw new Error(error.message);

    // Same fail-closed pattern as the parent path: the fee agreement rides
    // on the case row (payer is still the self-employed tutor — 1.5-lesson
    // admin fee, #412 CEO lock).
    const { recordTermsAcceptance } = await import("@/features/legal/terms-acceptance.server");
    try {
      await recordTermsAcceptance({
        userId: context.userId,
        surface: "case_request",
        termsVersion: FEE_TERMS_VERSION,
        subjectId: row.id as string,
        legalEntityName: org.legal_entity_name ?? org.name,
      });
    } catch (acceptanceError) {
      await supabaseAdmin
        .from("tutoring_cases")
        .delete()
        .eq("id", row.id as string);
      throw acceptanceError;
    }

    return { caseCode: row.case_code as string, status };
  });

/** Org-side case list for the business console "Requests" tab (#412). */
export const getOrganizationCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orgId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireOrgMembership(context.userId, data.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("tutoring_cases")
      .select(
        "id, case_code, title, status, sor_status, package_type, budget_min_hkd, budget_max_hkd, rate_unit, board_published_at, created_at, compliance_note",
      )
      .eq("organisation_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return rows as unknown as Array<{
      id: string;
      case_code: string;
      title: string;
      status: string;
      sor_status: string | null;
      package_type: string;
      budget_min_hkd: number | null;
      budget_max_hkd: number | null;
      rate_unit: string;
      board_published_at: string | null;
      created_at: string;
      compliance_note: string | null;
    }>;
  });

/**
 * #412 E: tutor-side clarify on a centre case. The tutor reads the screening
 * summary on the public case page; "I need to correct or clarify something"
 * writes the note and puts the case back into compliance_hold so staff can
 * re-screen before anything circulates. Service-role write, membership-free
 * (any authenticated tutor can flag), idempotent in effect.
 */
export const flagCaseComplianceConcern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        note: z.string().trim().min(10, "Describe what needs clarifying").max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("tutoring_cases")
      .select("id, status, compliance_triage")
      .eq("id", data.caseId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const triage = row?.compliance_triage as Record<string, unknown> | null;
    if (!row || triage?.scope !== "centre") {
      throw new Error("This request is not a centre engagement.");
    }
    const { error: updateError } = await supabaseAdmin
      .from("tutoring_cases")
      .update({
        status: "compliance_hold",
        compliance_note: data.note,
      } as never)
      .eq("id", row.id as string);
    if (updateError) throw new Error(updateError.message);
    return { ok: true };
  });
