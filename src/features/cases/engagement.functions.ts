import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Issue #412 F — the 1-page Engagement Summary, confirmed once per
 * engagement by both parties before contact details / lesson commencement
 * are finalised. Rows live in engagement_summaries (RLS-deny, service-role
 * only, mirroring the #201 SoR tables); every access goes through these fns.
 * MatchMax is NOT a party to the resulting Contract for Services (ToS §§3,5)
 * — the summary records arrangements, it does not join them.
 */

export type EngagementSummaryPayload = {
  caseCode: string;
  customerLegalName: string;
  educatorName: string;
  scope: string;
  rateStructure: string;
  paymentSchedule: string;
  payer: string;
  matchmaxFeeLine: string;
  autonomyNote: string | null;
};

export type EngagementSummary = {
  caseId: string;
  version: number;
  payload: EngagementSummaryPayload;
  tutorConfirmedAt: string | null;
  customerConfirmedAt: string | null;
  openChangeReports: Array<{ id: string; description: string; createdAt: string }>;
};

const FEE_LINES: Record<string, string> = {
  ongoing_1_5:
    "1.5-lesson admin fee (100% of Lesson 1 + 50% of Lesson 2), charged to the self-employed tutor after the first two introductions; 0% commission from Lesson 3 onwards.",
  short_20: "20% of the short-package tuition (5 lessons or fewer), settled after Lesson 1.",
  pro_bono: "HK$0 — pro-bono engagement, no admin fee.",
};

/** The static fee summary agreed on the org/parent forms (CEO lock: the
 * payer is always the self-employed tutor). */
export function engagementFeeLine(packageType: string | null | undefined): string {
  return FEE_LINES[packageType ?? ""] ?? FEE_LINES.ongoing_1_5;
}

type CaseRow = {
  id: string;
  case_code: string;
  title: string;
  subjects: string[] | null;
  package_type: string | null;
  budget_min: number | null;
  budget_max: number | null;
  rate_unit: string | null;
  parent_id: string | null;
  contact_name: string;
  matched_tutor_id: string | null;
  organisation_id: string | null;
  compliance_triage: Record<string, unknown> | null;
};

async function loadCase(caseId: string): Promise<CaseRow> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("tutoring_cases")
    .select(
      "id, case_code, title, subjects, package_type, budget_min, budget_max, rate_unit, parent_id, contact_name, matched_tutor_id, organisation_id, compliance_triage",
    )
    .eq("id", caseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Case not found.");
  return data as unknown as CaseRow;
}

async function requireStaff(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (const role of ["admin", "super_admin", "staff"] as const) {
    const { data } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return true;
  }
  return false;
}

/** Build (or rebuild) the summary payload from the live case + triage. */
async function buildPayload(c: CaseRow): Promise<EngagementSummaryPayload> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let organisation: { name: string; legal_entity_name: string | null } | null = null;
  if (c.organisation_id) {
    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name, legal_entity_name")
      .eq("id", c.organisation_id)
      .maybeSingle();
    organisation = (org as { name: string; legal_entity_name: string | null } | null) ?? null;
  }

  let educatorName = "To be confirmed";
  if (c.matched_tutor_id) {
    const { data: tutor } = await supabaseAdmin
      .from("tutors")
      .select("tutor_code, display_name")
      .eq("id", c.matched_tutor_id)
      .maybeSingle();
    const t = tutor as { tutor_code: string; display_name: string } | null;
    // Tutor real names never reach parents (#96 anonymity model) — the
    // summary shows the public display name + tutor code.
    if (t) educatorName = `${t.display_name} (${t.tutor_code})`;
  }

  const triage = c.compliance_triage ?? {};
  const centreScope = typeof triage.scopeDescription === "string" ? triage.scopeDescription : null;
  const scopeParts = [c.title, ...(c.subjects ?? [])];
  if (centreScope) scopeParts.push(centreScope);
  // The non-integration note is the point of the summary — always present.
  scopeParts.push("No administrative, reception, or general staff duties.");

  const unitSuffix =
    c.rate_unit === "lesson" ? "/lesson" : c.rate_unit === "month" ? "/month" : "/hr";
  const rateStructure =
    typeof triage.feeStructure === "string"
      ? [
          String(triage.feeStructure),
          typeof triage.feeAmount === "string" && triage.feeAmount
            ? triage.feeAmount
            : c.budget_max != null
              ? `HK$${c.budget_min ?? "–"}–${c.budget_max}${unitSuffix}`
              : null,
          triage.feeOpenToCounter === true ? "open to counter-proposal" : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : c.budget_max != null
        ? `HK$${c.budget_min ?? "–"}–${c.budget_max}${unitSuffix}`
        : "Rate as agreed directly between the parties";

  const autonomyParts: string[] = [];
  const methodLabel: Record<string, string> = {
    educator: "methodology set by the educator",
    mutual: "methodology agreed mutually",
    centre_controlled: "methodology directed by the centre",
  };
  if (typeof triage.methodologyOwner === "string" && methodLabel[triage.methodologyOwner]) {
    autonomyParts.push(methodLabel[triage.methodologyOwner]);
  }
  if (triage.otherClientsAllowed === "yes") autonomyParts.push("free to serve other clients");
  if (typeof triage.substitutionAllowed === "string" && triage.substitutionAllowed !== "no") {
    autonomyParts.push("substitution/delegation as agreed in advance");
  }

  return {
    caseCode: c.case_code,
    customerLegalName:
      organisation?.legal_entity_name || organisation?.name || c.contact_name || "The customer",
    educatorName,
    scope: scopeParts.join(" · "),
    rateStructure,
    paymentSchedule:
      "Paid directly between the customer and the educator by agreement; MatchMax is not a party to the lesson contract.",
    payer: "The self-employed educator (independent contractor)",
    matchmaxFeeLine: engagementFeeLine(c.package_type),
    autonomyNote: autonomyParts.length > 0 ? autonomyParts.join("; ") : null,
  };
}

async function loadSummaryRow(caseId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("engagement_summaries")
    .select("id, case_id, version, payload, tutor_confirmed_at, customer_confirmed_at")
    .eq("case_id", caseId)
    .maybeSingle();
  return data as {
    id: string;
    case_id: string;
    version: number;
    payload: EngagementSummaryPayload;
    tutor_confirmed_at: string | null;
    customer_confirmed_at: string | null;
  } | null;
}

/**
 * Idempotent auto-create, called when a case reaches the engagement stage
 * (SoR `introduced` transition / board `matched`). If the payload inputs
 * changed after a material-change re-screen, bumps the version and resets
 * confirmations so both parties confirm the CURRENT arrangement.
 */
export const ensureEngagementSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ caseId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => ensureEngagementSummaryRow(data.caseId));

/** Plain (non-server-fn) core so admin-desk transitions can call it inline. */
export async function ensureEngagementSummaryRow(caseId: string): Promise<{ version: number }> {
  {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const c = await loadCase(caseId);
    const existing = await loadSummaryRow(c.id);
    const payload = await buildPayload(c);
    if (existing) {
      const changed = JSON.stringify(existing.payload) !== JSON.stringify(payload);
      if (changed) {
        const { error } = await supabaseAdmin
          .from("engagement_summaries")
          .update({
            version: existing.version + 1,
            payload,
            tutor_confirmed_at: null,
            customer_confirmed_at: null,
          })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      }
      return { version: changed ? existing.version + 1 : existing.version };
    }
    const { error } = await supabaseAdmin.from("engagement_summaries").insert({
      case_id: c.id,
      version: 1,
      payload,
    } as never);
    if (error) {
      // A concurrent ensure lost the race to the UNIQUE(case_id) — fine.
      if (!`${error.message}`.includes("duplicate")) throw new Error(error.message);
    }
    return { version: 1 };
  }
}

/**
 * Read the summary for a case. Party-gated: the parent customer, the matched
 * tutor's account, an active org member of the centre, or staff.
 */
export const getEngagementSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ caseId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const c = await loadCase(data.caseId);
    const isStaff = await requireStaff(context.userId);

    if (!isStaff) {
      let allowed = c.parent_id === context.userId;
      if (!allowed && c.matched_tutor_id) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tutor } = await supabaseAdmin
          .from("tutors")
          .select("user_id")
          .eq("id", c.matched_tutor_id)
          .maybeSingle();
        allowed = (tutor as { user_id: string } | null)?.user_id === context.userId;
      }
      if (!allowed && c.organisation_id) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: member } = await supabaseAdmin
          .from("organization_members")
          .select("id")
          .eq("organization_id", c.organisation_id)
          .eq("user_id", context.userId)
          .eq("status", "active")
          .maybeSingle();
        allowed = Boolean(member);
      }
      if (!allowed) throw new Error("Forbidden");
    }

    const summary = await loadSummaryRow(c.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reports } = await supabaseAdmin
      .from("engagement_change_reports")
      .select("id, description, created_at, resolved_at")
      .eq("case_id", c.id)
      .order("created_at", { ascending: false })
      .limit(20);
    const role = isStaff ? "staff" : c.parent_id === context.userId ? "customer" : "tutor";
    return {
      role,
      summary: summary
        ? {
            caseId: summary.case_id,
            version: summary.version,
            payload: summary.payload,
            tutorConfirmedAt: summary.tutor_confirmed_at,
            customerConfirmedAt: summary.customer_confirmed_at,
            openChangeReports: (reports ?? [])
              .filter((r) => r.resolved_at === null)
              .map((r) => ({ id: r.id, description: r.description, createdAt: r.created_at })),
          }
        : null,
    };
  });

/** 1-click confirmation of the exact version shown (#412 F). */
export const confirmEngagementSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ caseId: z.string().uuid(), party: z.enum(["tutor", "customer"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const c = await loadCase(data.caseId);

    // Party check (staff confirm on behalf of neither party).
    if (data.party === "tutor") {
      if (!c.matched_tutor_id) throw new Error("No educator matched yet.");
      const { data: tutor } = await supabaseAdmin
        .from("tutors")
        .select("user_id")
        .eq("id", c.matched_tutor_id)
        .maybeSingle();
      if ((tutor as { user_id: string } | null)?.user_id !== context.userId) {
        throw new Error("Forbidden");
      }
    } else {
      let allowed = c.parent_id === context.userId;
      if (!allowed && c.organisation_id) {
        const { data: member } = await supabaseAdmin
          .from("organization_members")
          .select("id")
          .eq("organization_id", c.organisation_id)
          .eq("user_id", context.userId)
          .eq("status", "active")
          .maybeSingle();
        allowed = Boolean(member);
      }
      if (!allowed) throw new Error("Forbidden");
    }

    const nowIso = new Date().toISOString();
    const patch =
      data.party === "tutor" ? { tutor_confirmed_at: nowIso } : { customer_confirmed_at: nowIso };
    const { error } = await supabaseAdmin
      .from("engagement_summaries")
      .update(patch)
      .eq("case_id", c.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * "Report Material Change" (#412 F): either party logs a change to duties,
 * hours, or contracting structure. The report lands unresolved and the case
 * goes back into compliance_hold so staff re-screen — matching, circulation,
 * and contact release stay locked until they clear it.
 */
export const reportEngagementChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        role: z.enum(["tutor", "customer"]),
        description: z.string().trim().min(10).max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const c = await loadCase(data.caseId);
    const summary = await loadSummaryRow(c.id);
    const { error } = await supabaseAdmin.from("engagement_change_reports").insert({
      case_id: c.id,
      engagement_id: summary?.id ?? null,
      reported_by_role: data.role,
      reported_by_user: context.userId,
      description: data.description,
    } as never);
    if (error) throw new Error(error.message);
    const { error: holdError } = await supabaseAdmin
      .from("tutoring_cases")
      .update({ status: "compliance_hold", compliance_note: data.description })
      .eq("id", c.id);
    if (holdError) throw new Error(holdError.message);
    return { ok: true };
  });

/** Staff hook: resolve an open change report after re-screening. */
export const resolveEngagementChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ reportId: z.string().uuid(), note: z.string().trim().max(500).optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const isStaff = await requireStaff(context.userId);
    if (!isStaff) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("engagement_change_reports")
      .update({ resolved_at: new Date().toISOString(), resolution_note: data.note ?? null })
      .eq("id", data.reportId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
