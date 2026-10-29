/**
 * Issues #205 + #292, notification bus drain + bell.
 *
 * This repo has no cron (Workers Builds only), so the bus is drained lazily:
 * every bell fetch (getMyBell) and any authed /notifications load runs the
 * drain first. All steps are individually guarded, a failing email or a
 * transient query error must never crash the page that triggered the drain.
 *
 * Idempotence: deliveries are unique on (event_id, channel, recipient); event
 * generation is deduped on event_type:source_id keys.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  bellLinkFor,
  DELIVERY_MAX_ATTEMPTS,
  planDeliveriesForEvent,
  redactBellPayload,
  type BusChannel,
  type BusRole,
} from "@/features/cases/bus";
import {
  eventKey,
  shouldCreateConciergeDigest,
  shouldCreateParentFeeReminder,
  shouldCreateReminder,
  shouldCreateReviewPrompt,
  type DoneEvent,
  type OpenFee,
  type ReminderLesson,
} from "@/features/cases/bus-pure";

type Row = Record<string, unknown>;

type Db = ReturnType<typeof asAdminDb>;

const EVENT_BATCH = 50;

async function selectRows<T extends Row>(
  db: Db,
  table: string,
  cols: string,
  match: { col: string; op: "eq" | "in"; value: unknown }[],
  order?: { col: string; asc?: boolean; limit?: number },
): Promise<T[]> {
  let q = db.from<T>(table).select(cols);
  for (const m of match) {
    if (m.op === "eq") q = q.eq(m.col, m.value);
    else q = q.in(m.col, m.value as unknown[]);
  }
  if (order) q = q.order(order.col, { ascending: order.asc ?? true });
  if (order?.limit) q = q.limit(order.limit);
  const { data } = await q;
  return (data ?? []) as T[];
}

async function insertEvent(
  db: Db,
  eventType: string,
  payload: Record<string, unknown>,
  sourceId: string | null,
): Promise<void> {
  const { error } = await db
    .from<Row>("case_events")
    .insert({ event_type: eventType, payload, source_id: sourceId })
    .select("id")
    .single();
  if (error && !/duplicate|unique/i.test(error?.message ?? "")) {
    throw new Error(`insert event ${eventType}: ${error?.message ?? "unknown"}`);
  }
}

// ---------------------------------------------------------------------------
// Event generation (lazy, replaces the cron this repo does not have)
// ---------------------------------------------------------------------------

async function generateReminderEvents(db: Db, now: Date): Promise<void> {
  const horizon = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const lessons = await selectRows<ReminderLesson & { case_id: string }>(
    db,
    "case_lessons",
    "id, case_id, starts_at, status",
    [{ col: "status", op: "in", value: ["planned", "confirmed"] }],
  );
  const due = lessons.filter((l) => {
    const t = Date.parse(l.starts_at);
    return t >= now.getTime() && t <= horizon.getTime();
  });
  if (due.length === 0) return;

  const existing = await selectRows<{ source_id: string | null }>(db, "case_events", "source_id", [
    { col: "event_type", op: "eq", value: "lesson.reminder_due" },
  ]);
  const keys = new Set(existing.map((e) => eventKey("lesson.reminder_due", e.source_id)));

  for (const l of due) {
    if (!shouldCreateReminder(l, now, keys)) continue;
    await insertEvent(
      db,
      "lesson.reminder_due",
      { case_id: l.case_id, lesson_id: l.id, starts_at: l.starts_at },
      l.id,
    );
    keys.add(eventKey("lesson.reminder_due", l.id));
  }
}

async function generateReviewPrompts(db: Db, now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const doneEvents = await selectRows<{
    id: string;
    payload: Record<string, unknown>;
    created_at: string;
  }>(
    db,
    "case_events",
    "id, payload, created_at",
    [{ col: "event_type", op: "eq", value: "lesson.done" }],
    { col: "created_at", asc: true, limit: EVENT_BATCH },
  );
  const pending = doneEvents.filter((e) => Date.parse(e.created_at) <= cutoff.getTime());
  if (pending.length === 0) return;

  const lessonIds = [...new Set(pending.map((e) => String(e.payload?.lesson_id)).filter(Boolean))];
  if (lessonIds.length === 0) return;

  const reviewed = await selectRows<{ lesson_id: string | null }>(db, "case_reviews", "lesson_id", [
    { col: "lesson_id", op: "in", value: lessonIds },
  ]);
  const reviewedSet = new Set(reviewed.map((r) => r.lesson_id));

  const existing = await selectRows<{ source_id: string | null }>(db, "case_events", "source_id", [
    { col: "event_type", op: "eq", value: "lesson.review_prompt" },
  ]);
  const keys = new Set(existing.map((e) => eventKey("lesson.review_prompt", e.source_id)));

  for (const e of pending) {
    const done: DoneEvent = { id: e.id, payload: e.payload ?? {}, created_at: e.created_at };
    const lessonId = String(done.payload.lesson_id);
    if (!shouldCreateReviewPrompt(done, now, reviewedSet.has(lessonId), keys)) continue;
    await insertEvent(
      db,
      "lesson.review_prompt",
      {
        case_id: done.payload.case_id,
        lesson_id: lessonId,
        starts_at: done.payload.starts_at ?? null,
        tutor_id: done.payload.tutor_id ?? null,
      },
      lessonId,
    );
    keys.add(eventKey("lesson.review_prompt", lessonId));
  }
}

async function generateFeeEvents(db: Db, now: Date): Promise<void> {
  const fees = await selectRows<
    OpenFee & { case_id: string; amount_hkd: number; rate_hkd: number }
  >(db, "case_fees", "id, case_id, due_at, status, amount_hkd, rate_hkd", [
    { col: "status", op: "eq", value: "invoiced" },
  ]);
  const pastDue = fees.filter((f) => f.due_at && Date.parse(f.due_at) <= now.getTime());

  if (pastDue.length > 0) {
    const feeIds = pastDue.map((f) => f.id);
    const existing = await selectRows<{
      source_id: string | null;
      payload: Record<string, unknown>;
    }>(db, "case_events", "source_id, payload", [
      { col: "event_type", op: "eq", value: "admin_fee.unpaid" },
    ]);
    const lastDayByFee = new Map<string, number>();
    for (const e of existing) {
      if (e.source_id == null) continue;
      const day = Number(e.payload?.day ?? 0);
      if (Number.isFinite(day) && day > (lastDayByFee.get(e.source_id) ?? 0)) {
        lastDayByFee.set(e.source_id, day);
      }
    }

    for (const f of pastDue) {
      const reminder = shouldCreateParentFeeReminder(f, now, lastDayByFee.get(f.id) ?? null);
      if (!reminder) continue;
      await insertEvent(
        db,
        "admin_fee.unpaid",
        { case_id: f.case_id, fee_id: f.id, amount_hkd: f.amount_hkd, day: reminder.day },
        f.id,
      );
    }

    const lastDigest = await selectRows<{ created_at: string }>(
      db,
      "case_events",
      "created_at",
      [{ col: "event_type", op: "eq", value: "admin_fee.digest" }],
      { col: "created_at", asc: false, limit: 1 },
    );
    const lastDigestAt = lastDigest[0] ? new Date(lastDigest[0].created_at) : null;
    const totalHkd = pastDue.reduce((sum, f) => sum + Number(f.amount_hkd ?? 0), 0);
    if (shouldCreateConciergeDigest(pastDue.length, lastDigestAt, now)) {
      // The digest email mirrors the admin unpaid queue (#201/#205): parent,
      // tutor, amount, and the admin-only WhatsApp link, oldest first.
      const caseIds = [...new Set(pastDue.map((f) => f.case_id))];
      const cases = await selectRows<{
        id: string;
        case_code: string;
        contact_name: string;
        whatsapp_group_url: string | null;
        matched_tutor_id: string | null;
      }>(
        db,
        "tutoring_cases",
        "id, case_code, contact_name, whatsapp_group_url, matched_tutor_id",
        [{ col: "id", op: "in", value: caseIds }],
      );
      const tutorIds = [
        ...new Set(cases.map((c) => c.matched_tutor_id).filter(Boolean)),
      ] as string[];
      const tutors = tutorIds.length
        ? await selectRows<{ id: string; display_name: string; tutor_code: string }>(
            db,
            "tutors",
            "id, display_name, tutor_code",
            [{ col: "id", op: "in", value: tutorIds }],
          )
        : [];
      const caseById = new Map(cases.map((c) => [c.id, c]));
      const tutorById = new Map(tutors.map((t) => [t.id, t]));

      const withDue = pastDue
        .filter((f) => f.due_at)
        .sort((a, b) => Date.parse(a.due_at ?? "") - Date.parse(b.due_at ?? ""));
      const lines = withDue.map((f) => {
        const c = caseById.get(f.case_id);
        const t = c?.matched_tutor_id ? tutorById.get(c.matched_tutor_id) : undefined;
        const daysOverdue = Math.max(
          0,
          Math.floor((now.getTime() - Date.parse(f.due_at ?? "")) / 86400000),
        );
        return [
          c?.case_code ?? "case",
          c?.contact_name ?? "parent",
          t ? `${t.display_name} (${t.tutor_code})` : "tutor",
          `HK$${Number(f.amount_hkd ?? 0).toFixed(2)}`,
          `${daysOverdue}d overdue`,
          c?.whatsapp_group_url ?? "",
        ].join(" | ");
      });

      await insertEvent(
        db,
        "admin_fee.digest",
        { count: pastDue.length, total_hkd: Math.round(totalHkd * 100) / 100, lines },
        null,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Event processing: plan deliveries, resolve recipients, send
// ---------------------------------------------------------------------------

type CaseCtx = {
  parent_id: string | null;
  concierge_id: string | null;
  matched_tutor_id: string | null;
};

async function resolveRecipients(
  db: Db,
  eventType: string,
  payload: Record<string, unknown>,
  roles: readonly BusRole[],
): Promise<{ role: BusRole; accountId: string }[]> {
  const needCase = roles.some((r) => r === "parent" || r === "concierge");
  const needTutorUser = roles.includes("tutor");

  let caseCtx: CaseCtx | null = null;
  const caseId = typeof payload.case_id === "string" ? payload.case_id : null;
  if (needCase && caseId) {
    const rows = await selectRows<CaseCtx>(
      db,
      "tutoring_cases",
      "parent_id, concierge_id, matched_tutor_id",
      [{ col: "id", op: "eq", value: caseId }],
    );
    caseCtx = rows[0] ?? null;
  }

  let tutorAccountId: string | null = null;
  const tutorId =
    typeof payload.tutor_id === "string" ? payload.tutor_id : (caseCtx?.matched_tutor_id ?? null);
  if (needTutorUser && tutorId) {
    const rows = await selectRows<{ user_id: string | null }>(db, "tutors", "user_id", [
      { col: "id", op: "eq", value: tutorId },
    ]);
    tutorAccountId = rows[0]?.user_id ?? null;
  }

  // note_order.delivered carries the buyer directly.
  const buyerId = typeof payload.buyer_account_id === "string" ? payload.buyer_account_id : null;

  let conciergeId: string | null = caseCtx?.concierge_id ?? null;
  if (roles.includes("concierge") && !conciergeId) {
    // Fallback: any admin/super_admin account (user_roles.user_id = profiles.id).
    const admins = await selectRows<{ user_id: string }>(
      db,
      "user_roles",
      "user_id",
      [{ col: "role", op: "in", value: ["admin", "super_admin"] }],
      { col: "created_at", asc: true, limit: 1 },
    );
    conciergeId = admins[0]?.user_id ?? null;
  }

  const byRole: Partial<Record<BusRole, string | null>> = {
    parent: buyerId ?? caseCtx?.parent_id ?? null,
    tutor: tutorAccountId,
    concierge: conciergeId,
  };
  const out: { role: BusRole; accountId: string }[] = [];
  for (const role of roles) {
    const accountId = byRole[role];
    if (accountId) out.push({ role, accountId });
  }
  return out;
}

const EMAIL_TEMPLATE_BY_EVENT: Record<string, string> = {
  "admin_fee.unpaid": "fee-reminder",
  "note_order.delivered": "order-delivered",
  "admin_fee.digest": "concierge-unpaid-digest",
};

function fmtHkd(n: unknown): string {
  const v = Number(n ?? 0);
  return `HK$${(Number.isFinite(v) ? v : 0).toFixed(2)}`;
}

/** Resolve the display data each email template expects from event payloads. */
async function buildEmailTemplateData(
  db: Db,
  eventType: string,
  payload: Record<string, unknown>,
  recipientAccountId: string,
): Promise<Record<string, unknown>> {
  if (eventType === "admin_fee.unpaid") {
    const caseId = typeof payload.case_id === "string" ? payload.case_id : null;
    const feeId = typeof payload.fee_id === "string" ? payload.fee_id : null;
    const cases = caseId
      ? await selectRows<{ case_code: string }>(db, "tutoring_cases", "case_code", [
          { col: "id", op: "eq", value: caseId },
        ])
      : [];
    const fees = feeId
      ? await selectRows<{ due_at: string | null }>(db, "case_fees", "due_at", [
          { col: "id", op: "eq", value: feeId },
        ])
      : [];
    const dueAt = fees[0]?.due_at ? new Date(fees[0].due_at) : null;
    return {
      case_code: cases[0]?.case_code ?? "",
      caseCode: cases[0]?.case_code ?? "",
      amountHkd: fmtHkd(payload.amount_hkd),
      dueDate: dueAt ? dueAt.toISOString().slice(0, 10) : "",
    };
  }

  if (eventType === "note_order.delivered") {
    const materialId = typeof payload.material_id === "string" ? payload.material_id : null;
    const materials = materialId
      ? await selectRows<{ title: string }>(db, "digital_materials", "title", [
          { col: "id", op: "eq", value: materialId },
        ])
      : [];
    const title = materials[0]?.title ?? "your note";
    const buyerId = typeof payload.buyer_account_id === "string" ? payload.buyer_account_id : null;
    if (recipientAccountId === buyerId) {
      return { title, variant: "buyer" };
    }
    return {
      title,
      variant: "tutor",
      grossHkd: fmtHkd(payload.gross_hkd),
      netHkd: fmtHkd(payload.tutor_net_hkd),
    };
  }

  if (eventType === "admin_fee.digest") {
    return {
      count: Number(payload.count ?? 0),
      totalHkd: fmtHkd(payload.total_hkd),
      lines: Array.isArray(payload.lines) ? (payload.lines as string[]) : [],
    };
  }

  return { ...payload };
}

async function deliverOne(
  db: Db,
  eventId: string,
  channel: BusChannel,
  accountId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  // Insert-if-absent (the unique index backstops races).
  const existing = await selectRows<{ id: string; status: string; attempts: number }>(
    db,
    "event_deliveries",
    "id, status, attempts",
    [
      { col: "event_id", op: "eq", value: eventId },
      { col: "channel", op: "eq", value: channel },
      { col: "recipient_account_id", op: "eq", value: accountId },
    ],
  );
  let deliveryId: string | undefined = existing[0]?.id;
  if (!deliveryId) {
    const { data, error } = await db
      .from<Row>("event_deliveries")
      .insert({ event_id: eventId, channel, recipient_account_id: accountId, status: "pending" })
      .select("id")
      .single();
    if (error) return; // unique race or FK issue, another drain owns it
    const inserted = data as { id: string } | null;
    deliveryId = inserted?.id;
    if (!deliveryId) return;
  } else if (existing[0].status === "sent") {
    return; // idempotent: already delivered
  }

  if (channel === "email") {
    const template = EMAIL_TEMPLATE_BY_EVENT[eventType];
    if (!template) return;
    const profiles = await selectRows<{ email: string | null }>(db, "profiles", "email", [
      { col: "id", op: "eq", value: accountId },
    ]);
    const email = profiles[0]?.email;
    if (!email) return;

    let templateData: Record<string, unknown>;
    try {
      templateData = await buildEmailTemplateData(db, eventType, payload, accountId);
    } catch {
      templateData = { ...payload };
    }

    let ok = false;
    let errMsg: string | null = null;
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const res = await sendTemplateEmail(template, email, {
        templateData,
        idempotencyKey: `bus:${deliveryId}`,
      });
      ok = res.sent === true || (res as { sent?: boolean }).sent !== false;
    } catch (err) {
      errMsg = err instanceof Error ? err.message : String(err);
      ok = false;
    }
    const attempts = (existing[0]?.attempts ?? 0) + 1;
    const status = ok ? "sent" : attempts >= DELIVERY_MAX_ATTEMPTS ? "failed" : "pending";
    await db
      .from<Row>("event_deliveries")
      .update({
        status,
        attempts,
        sent_at: ok ? new Date().toISOString() : null,
        error: ok ? null : (errMsg ?? "send failed"),
      })
      .eq("id", deliveryId);
    return;
  }

  // in_app: delivered the moment the row exists and is marked sent.
  await db
    .from<Row>("event_deliveries")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", deliveryId);
}

async function processPendingEvents(db: Db, now: Date): Promise<void> {
  const events = await selectRows<{
    id: string;
    event_type: string;
    payload: Record<string, unknown>;
  }>(
    db,
    "case_events",
    "id, event_type, payload",
    [{ col: "status", op: "eq", value: "pending" }],
    { col: "created_at", asc: true, limit: 20 },
  );

  for (const ev of events) {
    try {
      const plan = planDeliveriesForEvent(ev.event_type);
      if (plan.kind === "skip") {
        await db
          .from<Row>("case_events")
          .update({ status: "processed", processed_at: now.toISOString() })
          .eq("id", ev.id);
        continue;
      }
      if (plan.kind === "unknown") {
        await db
          .from<Row>("case_events")
          .update({
            status: "failed",
            last_error: "unknown event type",
            processed_at: now.toISOString(),
          })
          .eq("id", ev.id);
        continue;
      }

      const recipients = await resolveRecipients(db, ev.event_type, ev.payload ?? {}, [
        ...new Set(plan.deliveries.map((d) => d.role)),
      ]);
      const byRole = new Map(recipients.map((r) => [r.role, r.accountId]));

      let anySent = false;
      let allFailed = plan.deliveries.length > 0;
      for (const d of plan.deliveries) {
        const accountId = byRole.get(d.role);
        if (!accountId) {
          allFailed = false; // no recipient for that role: nothing to deliver
          continue;
        }
        try {
          await deliverOne(db, ev.id, d.channel, accountId, ev.event_type, ev.payload ?? {});
          anySent = true;
        } catch {
          // delivery failure recorded on the row; fall through to the event update
        }
      }

      await db
        .from<Row>("case_events")
        .update({
          status: allFailed && !anySent ? "failed" : "processed",
          last_error: allFailed && !anySent ? "all deliveries failed" : null,
          process_attempts: 1,
          processed_at: now.toISOString(),
        })
        .eq("id", ev.id);
    } catch (err) {
      // Leave the event pending for the next drain; record the reason.
      await db
        .from<Row>("case_events")
        .update({ last_error: err instanceof Error ? err.message : String(err) })
        .eq("id", ev.id)
        .catch(() => undefined);
    }
  }
}

export async function drainInternal(db: Db, now: Date = new Date()): Promise<void> {
  try {
    await generateReminderEvents(db, now);
  } catch (err) {
    console.error("[bus] reminder generation failed", err);
  }
  try {
    await generateReviewPrompts(db, now);
  } catch (err) {
    console.error("[bus] review prompt generation failed", err);
  }
  try {
    await generateFeeEvents(db, now);
  } catch (err) {
    console.error("[bus] fee event generation failed", err);
  }
  try {
    await processPendingEvents(db, now);
  } catch (err) {
    console.error("[bus] event processing failed", err);
  }
}

// ---------------------------------------------------------------------------
// Public server fns
// ---------------------------------------------------------------------------

/** JSON-safe event payload (server-fn boundaries reject unknown index signatures). */
export type EventPayload = { [key: string]: string | number | boolean | null | string[] };

export type BellItem = {
  id: string;
  event_type: string;
  payload: EventPayload;
  created_at: string;
  read: boolean;
  link: string | null;
  /** Which side of the event the recipient is on, drives the label (#292). */
  role_hint: "tutor" | "parent" | "concierge" | "unknown";
};

export const getMyBell = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ unread: number; items: BellItem[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await drainInternal(db);

    const rows = await selectRows<{
      id: string;
      read_at: string | null;
      created_at: string;
      case_events: { event_type: string; payload: Record<string, unknown> } | null;
    }>(
      db,
      "event_deliveries",
      "id, read_at, created_at, case_events(event_type, payload)",
      [
        { col: "recipient_account_id", op: "eq", value: context.userId },
        { col: "channel", op: "eq", value: "in_app" },
        { col: "status", op: "eq", value: "sent" },
      ],
      { col: "created_at", asc: false, limit: 15 },
    );

    // lesson.reminder_due reaches both sides of a case; the delivery row carries
    // no role, so derive it from the case owner (one batched query, only when a
    // reminder is actually in the inbox).
    const reminderCaseIds = [
      ...new Set(
        rows
          .filter((r) => r.case_events?.event_type === "lesson.reminder_due")
          .map((r) => r.case_events?.payload?.case_id)
          .filter((v): v is string => typeof v === "string"),
      ),
    ];
    const reminderOwnerByCase = new Map<string, string>();
    if (reminderCaseIds.length > 0) {
      const reminderCases = await selectRows<{ id: string; parent_id: string | null }>(
        db,
        "tutoring_cases",
        "id, parent_id",
        [{ col: "id", op: "in", value: reminderCaseIds }],
      );
      for (const c of reminderCases) {
        if (c.parent_id) reminderOwnerByCase.set(c.id, c.parent_id);
      }
    }

    const items: BellItem[] = rows.map((r) => {
      const eventType = r.case_events?.event_type ?? "unknown";
      const payload = r.case_events?.payload ?? {};
      let roleHint: BellItem["role_hint"] = "unknown";
      if (eventType === "note_order.delivered") {
        roleHint = payload.buyer_account_id === context.userId ? "parent" : "tutor";
      } else if (eventType.startsWith("admin_fee")) {
        roleHint = eventType === "admin_fee.digest" ? "concierge" : "parent";
      } else if (eventType === "review.published" || eventType === "lesson.review_prompt") {
        roleHint = eventType === "review.published" ? "tutor" : "parent";
      } else if (eventType === "experience.session_logged") {
        // The log is parent-facing by design (#387): only the parent gets the
        // delivery, so the hint is statically theirs.
        roleHint = "parent";
      } else if (eventType === "case.end_requested_by_parent") {
        // #503 soft prompt: the event type names the ACTOR, the delivery goes
        // to the other party only, so the hint is statically the recipient's.
        roleHint = "tutor";
      } else if (eventType === "case.end_requested_by_tutor") {
        roleHint = "parent";
      } else if (eventType === "lesson.reminder_due") {
        const caseId = typeof payload.case_id === "string" ? payload.case_id : null;
        roleHint =
          caseId && reminderOwnerByCase.get(caseId) === context.userId ? "parent" : "tutor";
      }
      return {
        id: r.id,
        event_type: eventType,
        payload: redactBellPayload(eventType, payload ?? {}, roleHint) as EventPayload,
        created_at: r.created_at,
        read: r.read_at !== null,
        link: bellLinkFor(eventType, payload ?? {}, roleHint),
        role_hint: roleHint,
      };
    });
    const unread = items.filter((i) => !i.read).length;
    // Unread count may exceed the 15 shown; count precisely.
    if (rows.length === 15) {
      const all = await selectRows<{ id: string; read_at: string | null }>(
        db,
        "event_deliveries",
        "id, read_at",
        [
          { col: "recipient_account_id", op: "eq", value: context.userId },
          { col: "channel", op: "eq", value: "in_app" },
          { col: "status", op: "eq", value: "sent" },
        ],
      );
      return { unread: all.filter((r) => r.read_at === null).length, items };
    }
    return { unread, items };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => {
    const parsed = z
      .object({ ids: z.array(z.string()).optional() })
      .optional()
      .parse(input);
    return parsed ?? {};
  })
  .handler(async ({ context, data }): Promise<{ ok: boolean; cleared: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const patch = { read_at: new Date().toISOString() };
    const requestedIds = data?.ids;

    let ids: string[];
    if (requestedIds && requestedIds.length > 0) {
      ids = requestedIds;
    } else {
      // "all": clear every unread in-app row (red dot clears when list opened, #292).
      const unread = await selectRows<{ id: string }>(db, "event_deliveries", "id", [
        { col: "recipient_account_id", op: "eq", value: context.userId },
        { col: "channel", op: "eq", value: "in_app" },
        { col: "status", op: "eq", value: "sent" },
      ]);
      ids = unread.map((r) => r.id);
    }

    let cleared = 0;
    for (const id of ids) {
      // Only rows owned by the caller can match; scope by recipient as well.
      const owned = await selectRows<{ id: string }>(db, "event_deliveries", "id", [
        { col: "id", op: "eq", value: id },
        { col: "recipient_account_id", op: "eq", value: context.userId },
      ]);
      if (owned.length === 0) continue;
      const { error } = await db.from<Row>("event_deliveries").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
      cleared += 1;
    }
    return { ok: true, cleared };
  });
