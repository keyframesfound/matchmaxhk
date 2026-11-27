// #717 / #783 §2.3: the "3 tutors with open slots" sweep. `tasks/tutor-suggestions.ts`
// dynamic-imports `runTutorSuggestionSweep` from here (Nitro bundles tasks/
// separately and cannot resolve the app's `@/` alias chain).
//
// Gates, in order — any one closes the run:
// 1. app_settings.tutor_suggestion_emails_enabled must be true (default: no
//    row = off). The owner turns sending on; nothing goes out before that.
// 2. Tuesday or Thursday, 11:00 HKT (the hourly trigger self-gates).
// 3. The recipient opted in (profiles.marketing_email_opt_in).
// 4. 14 days since that parent's last suggestion email (our log).
// 5. sendTemplateEmail re-checks same-subject suppression and claims the
//    7-day automated slot atomically (claim_automated_digest_slot).
// Deterministic: live capacity + the #657 eligibility score. No AI ranking.

import { selectRows, type Db } from "@/features/cases/desk-db";
import { loadMatchTutors } from "@/features/cases/case-match-waves.functions";
import {
  cooldownOpen,
  isSuggestionSlot,
  pickSuggestionTutors,
  recentlySuggested,
  suggestionInterests,
  withoutActiveSubjects,
  type SuggestionTutor,
} from "@/features/search/tutor-suggestions";

export const SUGGESTIONS_ENABLED_SETTING = "tutor_suggestion_emails_enabled";
const MAX_RECIPIENTS_PER_RUN = 200;
const SITE_URL = "https://matchmax.hk";
const CLOSED_SOR = new Set(["replaced", "closed"]);

export type SuggestionSweepResult = {
  ran: boolean;
  reason?: "disabled" | "not_slot";
  considered: number;
  sent: number;
};

async function enabled(db: Db): Promise<boolean> {
  const rows = await selectRows<{ value: unknown }>(db, "app_settings", "value", [
    { col: "key", op: "eq", value: SUGGESTIONS_ENABLED_SETTING },
  ]);
  return rows[0]?.value === true;
}

async function loadPool(db: Db, now: Date): Promise<SuggestionTutor[]> {
  const tutors = await loadMatchTutors(db, [], now);
  const ids = tutors.map((t) => t.id);
  if (ids.length === 0) return [];
  const extras = await selectRows<{
    id: string;
    remaining_student_slots: number | null;
    hourly_rate: number | null;
    min_hourly_rate_hkd: number | null;
    display_name: string | null;
    verification_tier: string | null;
    undergrad_university: string | null;
    academic_headline: string | null;
  }>(
    db,
    "tutors",
    "id, remaining_student_slots, hourly_rate, min_hourly_rate_hkd, display_name, verification_tier, undergrad_university, academic_headline",
    [{ col: "id", op: "in", value: ids }],
  );
  const byId = new Map(extras.map((e) => [e.id, e]));
  return tutors.map((t) => {
    const e = byId.get(t.id);
    const rate = Number(e?.min_hourly_rate_hkd ?? e?.hourly_rate);
    return {
      ...t,
      remainingSlots: e?.remaining_student_slots ?? null,
      rateHkd: Number.isFinite(rate) && rate > 0 ? Math.round(rate) : null,
      displayName: (e?.display_name ?? "").trim() || t.tutorCode,
      verified: e?.verification_tier === "tier_2_verified",
      credential: e?.academic_headline?.trim() || e?.undergrad_university?.trim() || null,
    };
  });
}

export async function runTutorSuggestionSweep(db: Db, now: Date): Promise<SuggestionSweepResult> {
  if (!(await enabled(db))) return { ran: false, reason: "disabled", considered: 0, sent: 0 };
  if (!isSuggestionSlot(now)) return { ran: false, reason: "not_slot", considered: 0, sent: 0 };

  const recipients = (
    await selectRows<{
      id: string;
      email: string | null;
      display_name: string | null;
      locale: string | null;
    }>(db, "profiles", "id, email, display_name, locale", [
      { col: "marketing_email_opt_in", op: "eq", value: true },
    ])
  ).slice(0, MAX_RECIPIENTS_PER_RUN);
  if (recipients.length === 0) return { ran: true, considered: 0, sent: 0 };

  const pool = await loadPool(db, now);
  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  let sent = 0;

  for (const r of recipients) {
    if (!r.email) continue;
    try {
      const log = await selectRows<{ tutor_ids: string[]; sent_at: string }>(
        db,
        "tutor_suggestion_email_log",
        "tutor_ids, sent_at",
        [{ col: "user_id", op: "eq", value: r.id }],
      );
      const last =
        log
          .map((row) => row.sent_at)
          .sort()
          .at(-1) ?? null;
      if (!cooldownOpen(last, now)) continue;

      const [searches, children, cases] = await Promise.all([
        selectRows<{
          scope: string;
          params: Record<string, unknown>;
          created_at: string;
          last_checked_at: string | null;
        }>(db, "saved_searches", "scope, params, created_at, last_checked_at", [
          { col: "account_id", op: "eq", value: r.id },
        ]),
        selectRows<{
          subjects: string[] | null;
          curriculum: string | null;
          updated_at: string | null;
          created_at: string;
          archived_at: string | null;
        }>(db, "students", "subjects, curriculum, updated_at, created_at, archived_at", [
          { col: "parent_user_id", op: "eq", value: r.id },
        ]),
        selectRows<{
          subjects: string[] | null;
          matched_tutor_id: string | null;
          sor_status: string | null;
        }>(db, "tutoring_cases", "subjects, matched_tutor_id, sor_status", [
          { col: "parent_id", op: "eq", value: r.id },
        ]),
      ]);
      // Live matches right now (#615 active case / #772 trial on that case):
      // re-read at send time so a match made an hour ago suppresses the subject.
      const activeSubjects = cases
        .filter((c) => c.matched_tutor_id && !CLOSED_SOR.has(c.sor_status ?? ""))
        .flatMap((c) => c.subjects ?? []);
      const interests = withoutActiveSubjects(
        suggestionInterests({
          savedSearches: searches.map((s) => ({
            scope: s.scope,
            params: s.params ?? {},
            at: s.last_checked_at ?? s.created_at,
          })),
          children: children
            .filter((c) => !c.archived_at)
            .map((c) => ({
              subjects: c.subjects,
              curriculum: c.curriculum,
              at: c.updated_at ?? c.created_at,
            })),
          now,
        }),
        activeSubjects,
      );
      const recent = recentlySuggested(log, now);

      for (const interest of interests) {
        const picks = pickSuggestionTutors(interest, pool, recent, r.id, now);
        if (picks.length === 0) continue; // never a partial email
        const zh = (r.locale ?? "").toLowerCase().startsWith("zh");
        const subjectLabel = [interest.curriculum, interest.subject].filter(Boolean).join(" ");
        const result = await sendTemplateEmail("tutor-suggestions", r.email, {
          marketingUserId: r.id,
          promoSubjects: [interest.subject],
          activeSubjects,
          idempotencyKey: `tutor-suggestions:${r.id}:${now.toISOString().slice(0, 13)}`,
          templateData: {
            parentName: (r.display_name ?? "").trim().split(/\s+/)[0] || "",
            subjectLabel,
            locale: zh ? "zh-HK" : "en",
            tutors: picks.map((p) => ({
              name: p.displayName,
              verified: p.verified,
              credential: p.credential,
              subjects: p.subjects,
              area: p.area,
              remainingSlots: p.remainingSlots,
              rateHkd: p.rateHkd,
              reason: p.reason,
              url: `${SITE_URL}/${zh ? "zh" : "en"}/tutors/${encodeURIComponent(p.tutorCode)}`,
            })),
          },
        });
        if (result.sent) {
          await db.from<Record<string, unknown>>("tutor_suggestion_email_log").insert({
            user_id: r.id,
            subject: interest.subject.slice(0, 120),
            curriculum: interest.curriculum?.slice(0, 60) ?? null,
            tutor_ids: picks.map((p) => p.tutorId),
          });
          sent += 1;
        }
        break; // one email per parent per run, whatever the outcome
      }
    } catch (error) {
      // One bad recipient must not stop the run.
      console.warn("[tutor-suggestions] recipient skipped:", error);
    }
  }
  return { ran: true, considered: recipients.length, sent };
}
