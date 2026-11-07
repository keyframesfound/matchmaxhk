/**
 * #613 Course/Case Roster + 1-Tap Attendance + Parent Claim Magic Link.
 *
 * Server fns over the roster_* tables (migration
 * 20261107230000_issue_613_rosters_attendance.sql). The tables are NOT in the
 * generated Supabase types (never regenerate from this feature), so every
 * table gets ONE structural Rows<T>-style type here, in the
 * features/materials/storage-helpers.ts pattern: the real builder is a
 * thenable whose filters return the builder itself, awaiting the chain yields
 * the array, only maybeSingle/single return result objects. Every handler
 * starts with an asAdminDb() service-role cast; RLS on the tables is
 * defense in depth, the permission checks below are the real gate.
 *
 * Pure rules (state machine, 24h window, idempotency, duplicates, token
 * expiry, HKT clock, share text) live in roster-logic.ts and are unit-tested
 * there; this file only orchestrates reads/writes.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import { insertLessonLifecycleEvent } from "@/features/cases/bus.functions";
import { getRuntimeEnv } from "@/lib/runtime-env";
import {
  ATTENDANCE_STATUSES,
  CLAIM_TOKEN_DAYS,
  ENGAGEMENT_TYPES,
  LOCKED_ENGAGEMENT,
  MAX_SESSION_NOTE_LENGTH,
  canCorrectAttendance,
  claimTokenState,
  contactKind,
  duplicateStudentKey,
  editCountDelta,
  engagementLockedFor,
  isStaleVersion,
  isValidSessionKey,
  normalizeContact,
  normalizeStudentName,
  sourceTagForRoster,
  buildShareTextBoth,
  buildShareTextEn,
  buildShareTextZh,
  type AttendanceStatus,
  type SessionStatus,
  type SourceType,
} from "@/features/rosters/roster-logic";

// ---------------------------------------------------------------------------
// Structural client types for the new tables (#613 — not in generated types)
// ---------------------------------------------------------------------------

export type RosterRow = {
  id: string;
  owner_user_id: string;
  organization_id: string | null;
  course_id: string | null;
  case_id: string | null;
  case_code: string | null;
  source_type: SourceType;
  title: string;
  created_at: string;
  updated_at: string;
};

export type RosterStudentRow = {
  id: string;
  roster_id: string;
  display_name: string;
  display_name_normalized: string;
  parent_contact: string;
  parent_contact_normalized: string;
  link_status: "linked" | "pending_link";
  linked_account_id: string | null;
  source_tag: "matchmax_matched" | "self_brought";
  engagement_type: "standard_ongoing" | "short_course";
  package_lesson_count: number | null;
  completed_lesson_count: number;
  converted_enquiry_ref: string | null;
  created_at: string;
  updated_at: string;
};

export type RosterSessionRow = {
  id: string;
  roster_id: string;
  session_key: string;
  session_date: string;
  start_time: string;
  session_note: string | null;
  marker_user_id: string;
  status: SessionStatus;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RosterAttendanceRow = {
  id: string;
  session_id: string;
  roster_id: string;
  roster_student_id: string;
  status: AttendanceStatus;
  marked_by_user_id: string;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RosterMarkerRow = {
  id: string;
  roster_id: string;
  marker_user_id: string;
  assigned_by_user_id: string;
  revoked_at: string | null;
  created_at: string;
};

export type RosterClaimTokenRow = {
  id: string;
  roster_student_id: string;
  created_by_user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  used_by_user_id: string | null;
  revoked_at: string | null;
  created_at: string;
};

/** The #613 tables the fns touch, typed just enough for the chains below. */
export type RosterDb = Db;

async function rosterDb(): Promise<RosterDb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function generateRawToken(): string {
  // #613: cryptographically random, 32 bytes — non-guessable claim links.
  return randomBytes(32).toString("base64url");
}

const SITE_URL = "https://matchmax.hk";

// ---------------------------------------------------------------------------
// Permissions (the real gate; RLS mirrors these for non-service clients)
// ---------------------------------------------------------------------------

async function fetchRosterRow(db: RosterDb, rosterId: string): Promise<RosterRow | null> {
  const rows = await selectRows<RosterRow>(
    db,
    "rosters",
    "id, owner_user_id, organization_id, course_id, case_id, case_code, source_type, title, created_at, updated_at",
    [{ col: "id", op: "eq", value: rosterId }],
  );
  return rows[0] ?? null;
}

async function isOrgAdmin(db: RosterDb, orgId: string, userId: string): Promise<boolean> {
  if (!orgId) return false;
  const rows = await selectRows<{ id: string }>(
    db,
    "organization_members",
    "id",
    [
      { col: "organization_id", op: "eq", value: orgId },
      { col: "user_id", op: "eq", value: userId },
      { col: "role", op: "in", value: ["owner", "admin"] },
      { col: "status", op: "eq", value: "active" },
    ],
    undefined,
  );
  return rows.length > 0;
}

async function isActiveMarker(db: RosterDb, rosterId: string, userId: string): Promise<boolean> {
  const rows = await selectRows<{ id: string }>(
    db,
    "roster_markers",
    "id",
    [
      { col: "roster_id", op: "eq", value: rosterId },
      { col: "marker_user_id", op: "eq", value: userId },
      { col: "revoked_at", op: "eq", value: null },
    ],
    undefined,
  );
  return rows.length > 0;
}

/** Owner (full control) or an active assigned marker (mark/edit only). */
type RosterAccess = {
  roster: RosterRow;
  isOwner: boolean;
  canManage: boolean;
  canMark: boolean;
};

async function requireRosterAccess(
  db: RosterDb,
  rosterId: string,
  userId: string,
  need: "mark" | "manage",
): Promise<RosterAccess> {
  const roster = await fetchRosterRow(db, rosterId);
  if (!roster) throw new Error("ROSTER_NOT_FOUND");
  const isOwner = roster.owner_user_id === userId;
  const orgAdmin =
    !isOwner && roster.organization_id
      ? await isOrgAdmin(db, roster.organization_id, userId)
      : false;
  const marker = !isOwner && !orgAdmin ? await isActiveMarker(db, rosterId, userId) : false;
  const canManage = isOwner || orgAdmin;
  const canMark = canManage || marker;
  if (need === "manage" ? !canManage : !canMark) throw new Error("ROSTER_FORBIDDEN");
  return { roster, isOwner, canManage, canMark };
}

// ---------------------------------------------------------------------------
// Event emission (structured domain events; #614 bell + #615 counters read
// the same stream, decoupled)
// ---------------------------------------------------------------------------

type EventPayload = { [key: string]: string | number | boolean | null | string[] };

async function emitAttendanceEvent(
  db: RosterDb,
  eventType: "attendance.recorded" | "attendance.updated",
  payload: EventPayload,
  sourceId: string,
): Promise<void> {
  // Best-effort (the lesson-lifecycle pattern): a failed insert must never
  // fail the attendance save; the bus dedupes on (event_type, source_id).
  await insertLessonLifecycleEvent(db, eventType, payload as Record<string, unknown>, sourceId);
}

// ---------------------------------------------------------------------------
// Educator: list + create rosters
// ---------------------------------------------------------------------------

export type MyRoster = {
  id: string;
  title: string;
  sourceType: SourceType;
  caseCode: string | null;
  courseId: string | null;
  isOwner: boolean;
  studentCount: number;
  linkedCount: number;
  completedLessonsTotal: number;
  createdAt: string;
};

export const listMyRosters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .handler(async ({ context }): Promise<{ rosters: MyRoster[] }> => {
    const db = await rosterDb();
    const userId = context.userId;

    const owned = await selectRows<RosterRow>(
      db,
      "rosters",
      "*",
      [{ col: "owner_user_id", op: "eq", value: userId }],
      { col: "created_at", asc: false, limit: 100 },
    );

    // Centre admins also see their organization's rosters.
    let orgRosters: RosterRow[] = [];
    const memberships = await selectRows<{ organization_id: string }>(
      db,
      "organization_members",
      "organization_id",
      [
        { col: "user_id", op: "eq", value: userId },
        { col: "role", op: "in", value: ["owner", "admin"] },
        { col: "status", op: "eq", value: "active" },
      ],
    );
    if (memberships.length > 0) {
      orgRosters = await selectRows<RosterRow>(
        db,
        "rosters",
        "*",
        [{ col: "organization_id", op: "in", value: memberships.map((m) => m.organization_id) }],
        { col: "created_at", asc: false, limit: 100 },
      );
    }

    const byId = new Map<string, RosterRow>();
    for (const r of [...owned, ...orgRosters]) byId.set(r.id, r);
    const rosters = [...byId.values()];
    if (rosters.length === 0) return { rosters: [] };

    const students = await selectRows<{
      id: string;
      roster_id: string;
      link_status: string;
      completed_lesson_count: number;
    }>(db, "roster_students", "id, roster_id, link_status, completed_lesson_count", [
      { col: "roster_id", op: "in", value: rosters.map((r) => r.id) },
    ]);
    const agg = new Map<string, { count: number; linked: number; completed: number }>();
    for (const s of students) {
      const a = agg.get(s.roster_id) ?? { count: 0, linked: 0, completed: 0 };
      a.count += 1;
      if (s.link_status === "linked") a.linked += 1;
      a.completed += Number(s.completed_lesson_count ?? 0);
      agg.set(s.roster_id, a);
    }

    return {
      rosters: rosters.map((r) => {
        const a = agg.get(r.id) ?? { count: 0, linked: 0, completed: 0 };
        return {
          id: r.id,
          title: r.title,
          sourceType: r.source_type,
          caseCode: r.case_code,
          courseId: r.course_id,
          isOwner: r.owner_user_id === userId,
          studentCount: a.count,
          linkedCount: a.linked,
          completedLessonsTotal: a.completed,
          createdAt: r.created_at,
        };
      }),
    };
  });

const createRosterInput = z.object({
  title: z.string().trim().min(1).max(120),
  sourceType: z.enum(["partner_course", "matched_case", "private_class"]),
  courseId: z.string().uuid().optional(),
  caseCode: z.string().trim().min(1).max(40).optional(),
});

export const createRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => createRosterInput.parse(input))
  .handler(async ({ context, data }): Promise<{ rosterId: string }> => {
    const db = await rosterDb();
    const userId = context.userId;
    let organizationId: string | null = null;
    let courseId: string | null = null;
    let caseId: string | null = null;

    if (data.sourceType === "partner_course") {
      if (!data.courseId) throw new Error("COURSE_REQUIRED");
      const courses = await selectRows<{ id: string; organization_id: string }>(
        db,
        "courses",
        "id, organization_id",
        [{ col: "id", op: "eq", value: data.courseId }],
      );
      const course = courses[0];
      if (!course) throw new Error("COURSE_NOT_FOUND");
      if (!(await isOrgAdmin(db, course.organization_id, userId))) {
        throw new Error("ROSTER_FORBIDDEN");
      }
      organizationId = course.organization_id;
      courseId = course.id;
    } else if (data.sourceType === "matched_case") {
      if (!data.caseCode) throw new Error("CASE_CODE_REQUIRED");
      const cases = await selectRows<{
        id: string;
        case_code: string;
        matched_tutor_id: string | null;
      }>(db, "tutoring_cases", "id, case_code, matched_tutor_id", [
        { col: "case_code", op: "eq", value: data.caseCode },
      ]);
      const kase = cases[0];
      if (!kase) throw new Error("CASE_NOT_FOUND");
      // Cap.57 separation: a Matched Case roster belongs to the educator the
      // platform matched — never an EA-style placement record.
      if (kase.matched_tutor_id) {
        const tutors = await selectRows<{ user_id: string | null }>(db, "tutors", "user_id", [
          { col: "id", op: "eq", value: kase.matched_tutor_id },
        ]);
        if (tutors[0]?.user_id !== userId) throw new Error("ROSTER_FORBIDDEN");
      }
      caseId = kase.id;
    }

    const { data: inserted, error } = await db
      .from<RosterRow>("rosters")
      .insert({
        owner_user_id: userId,
        organization_id: organizationId,
        course_id: courseId,
        case_id: caseId,
        case_code: data.caseCode ?? null,
        source_type: data.sourceType,
        title: data.title,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { rosterId: (inserted as unknown as { id: string }).id };
  });

// ---------------------------------------------------------------------------
// Educator: roster detail (§4.1 roster table)
// ---------------------------------------------------------------------------

export type RosterStudentView = {
  id: string;
  displayName: string;
  parentContact: string;
  linkStatus: "linked" | "pending_link";
  sourceTag: "matchmax_matched" | "self_brought";
  engagementType: "standard_ongoing" | "short_course";
  packageLessonCount: number | null;
  completedLessonCount: number;
  convertedEnquiryRef: string | null;
  hasActiveClaimLink: boolean;
};

export type RosterMarkerView = {
  id: string;
  markerUserId: string;
  markerName: string | null;
  revoked: boolean;
};

export type SessionAttendanceView = {
  attendanceId: string;
  rosterStudentId: string;
  studentName: string;
  status: AttendanceStatus;
  voided: boolean;
  markedAt: string;
  updatedAt: string;
  canCorrect: boolean;
};

export type RosterSessionView = {
  id: string;
  sessionDate: string;
  startTime: string;
  sessionNote: string | null;
  status: SessionStatus;
  markerUserId: string;
  createdAt: string;
  updatedAt: string;
  attendance: SessionAttendanceView[];
};

export type RosterDetail = {
  roster: {
    id: string;
    title: string;
    sourceType: SourceType;
    caseCode: string | null;
    courseId: string | null;
    organizationId: string | null;
    isOwner: boolean;
    canManage: boolean;
    canMark: boolean;
    engagementLocked: boolean;
  };
  students: RosterStudentView[];
  markers: RosterMarkerView[];
  sessions: RosterSessionView[];
};

export const getRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => z.object({ rosterId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<RosterDetail> => {
    const db = await rosterDb();
    const access = await requireRosterAccess(db, data.rosterId, context.userId, "mark");
    const roster = access.roster;

    const studentRows = await selectRows<RosterStudentRow>(
      db,
      "roster_students",
      "*",
      [{ col: "roster_id", op: "eq", value: roster.id }],
      { col: "created_at", asc: true, limit: 200 },
    );

    const sessionRows = await selectRows<RosterSessionRow>(
      db,
      "roster_sessions",
      "*",
      [{ col: "roster_id", op: "eq", value: roster.id }],
      { col: "session_date", asc: false, limit: 15 },
    );

    let attendanceRows: RosterAttendanceRow[] = [];
    if (sessionRows.length > 0) {
      attendanceRows = await selectRows<RosterAttendanceRow>(db, "roster_attendance", "*", [
        { col: "session_id", op: "in", value: sessionRows.map((s) => s.id) },
      ]);
    }

    const markerRows = await selectRows<RosterMarkerRow>(
      db,
      "roster_markers",
      "*",
      [{ col: "roster_id", op: "eq", value: roster.id }],
      { col: "created_at", asc: true, limit: 50 },
    );
    const markerNames = new Map<string, string | null>();
    if (markerRows.length > 0) {
      const profiles = await selectRows<{ id: string; display_name: string | null }>(
        db,
        "profiles",
        "id, display_name",
        [{ col: "id", op: "in", value: markerRows.map((m) => m.marker_user_id) }],
      );
      for (const p of profiles) markerNames.set(p.id, p.display_name);
    }

    // Active (unused, unrevoked, unexpired) claim links per student, for the
    // Copy Parent Link affordance.
    const activeTokens = new Set<string>();
    const pendingIds = studentRows.filter((s) => s.link_status === "pending_link").map((s) => s.id);
    if (pendingIds.length > 0) {
      const tokens = await selectRows<RosterClaimTokenRow>(db, "roster_claim_tokens", "*", [
        { col: "roster_student_id", op: "in", value: pendingIds },
      ]);
      const now = new Date();
      for (const t of tokens) {
        if (claimTokenState(t, now) === "valid") activeTokens.add(t.roster_student_id);
      }
    }

    const now = new Date();
    const nameById = new Map(studentRows.map((s) => [s.id, s.display_name]));
    const sessions: RosterSessionView[] = sessionRows.map((s) => {
      const rows = attendanceRows
        .filter((a) => a.session_id === s.id)
        .map((a) => ({
          attendanceId: a.id,
          rosterStudentId: a.roster_student_id,
          studentName: nameById.get(a.roster_student_id) ?? "",
          status: a.status,
          voided: a.voided_at != null,
          markedAt: a.created_at,
          updatedAt: a.updated_at,
          canCorrect: s.status !== "voided" && canCorrectAttendance(a.created_at, now),
        }))
        .sort((a, b) => a.studentName.localeCompare(b.studentName));
      return {
        id: s.id,
        sessionDate: s.session_date,
        startTime: s.start_time.slice(0, 5),
        sessionNote: s.session_note,
        status: s.status,
        markerUserId: s.marker_user_id,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        attendance: rows,
      };
    });

    return {
      roster: {
        id: roster.id,
        title: roster.title,
        sourceType: roster.source_type,
        caseCode: roster.case_code,
        courseId: roster.course_id,
        organizationId: roster.organization_id,
        isOwner: access.isOwner,
        canManage: access.canManage,
        canMark: access.canMark,
        engagementLocked: engagementLockedFor(roster.source_type),
      },
      students: studentRows.map((s) => ({
        id: s.id,
        displayName: s.display_name,
        parentContact: s.parent_contact,
        linkStatus: s.link_status,
        sourceTag: s.source_tag,
        engagementType: s.engagement_type,
        packageLessonCount: s.package_lesson_count,
        completedLessonCount: s.completed_lesson_count,
        convertedEnquiryRef: s.converted_enquiry_ref,
        hasActiveClaimLink: activeTokens.has(s.id),
      })),
      markers: markerRows.map((m) => ({
        id: m.id,
        markerUserId: m.marker_user_id,
        markerName: markerNames.get(m.marker_user_id) ?? null,
        revoked: m.revoked_at != null,
      })),
      sessions,
    };
  });

// ---------------------------------------------------------------------------
// Educator: add student (§3A) — duplicate-blocked, auto-link matched accounts
// ---------------------------------------------------------------------------

const addStudentInput = z.object({
  rosterId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(80),
  parentContact: z.string().trim().min(5).max(254),
  engagementType: z.enum(ENGAGEMENT_TYPES).optional(),
  packageLessonCount: z.union([z.literal(4), z.literal(8), z.literal(10)]).optional(),
  convertedEnquiryRef: z.string().trim().max(120).optional(),
});

export type AddStudentResult = {
  ok: true;
  studentId: string;
  linkStatus: "linked" | "pending_link";
  /** True when the same (name, contact) already existed — UI jumps to it. */
  duplicate: boolean;
};

async function findAccountByContact(db: RosterDb, contact: string): Promise<string | null> {
  const kind = contactKind(contact);
  if (kind === "email") {
    const rows = await selectRows<{ id: string }>(db, "profiles", "id", [
      { col: "email", op: "eq", value: contact.toLowerCase() },
    ]);
    return rows[0]?.id ?? null;
  }
  if (kind === "phone") {
    const normalized = normalizeContact(contact);
    const variants = [...new Set([normalized, normalized.replace(/^\+/, "")])];
    const rows = await selectRows<{ id: string }>(db, "profiles", "id", [
      { col: "phone", op: "in", value: variants },
    ]);
    return rows[0]?.id ?? null;
  }
  return null;
}

export const addRosterStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => addStudentInput.parse(input))
  .handler(async ({ context, data }): Promise<AddStudentResult> => {
    const db = await rosterDb();
    const access = await requireRosterAccess(db, data.rosterId, context.userId, "manage");

    const contact = normalizeContact(data.parentContact);
    if (contactKind(contact) == null) throw new Error("CONTACT_INVALID");
    const nameNormalized = normalizeStudentName(data.displayName);

    // #613 §3A/§5: duplicate active student (same name + same parent contact
    // in the same roster) is blocked — return the existing entry so a second
    // Add-to-Roster tap jumps to it instead of erroring.
    const existing = await selectRows<{ id: string }>(db, "roster_students", "id", [
      { col: "roster_id", op: "eq", value: access.roster.id },
      { col: "parent_contact_normalized", op: "eq", value: contact },
      { col: "display_name_normalized", op: "eq", value: nameNormalized },
    ]);
    if (existing[0]) {
      const linked = await selectRows<{ link_status: string; linked_account_id: string | null }>(
        db,
        "roster_students",
        "link_status, linked_account_id",
        [{ col: "id", op: "eq", value: existing[0].id }],
      );
      return {
        ok: true,
        studentId: existing[0].id,
        linkStatus: linked[0]?.link_status === "linked" ? "linked" : "pending_link",
        duplicate: true,
      };
    }

    // Account match decides LINKED vs PENDING_LINK at add time.
    const accountId = await findAccountByContact(db, data.parentContact);

    // Matched Cases auto-lock the engagement type (§3A).
    const engagement =
      engagementLockedFor(access.roster.source_type) || !data.engagementType
        ? LOCKED_ENGAGEMENT
        : data.engagementType;

    const { data: inserted, error } = await db
      .from<RosterStudentRow>("roster_students")
      .insert({
        roster_id: access.roster.id,
        display_name: data.displayName,
        display_name_normalized: nameNormalized,
        parent_contact: data.parentContact,
        parent_contact_normalized: contact,
        link_status: accountId ? "linked" : "pending_link",
        linked_account_id: accountId,
        source_tag: sourceTagForRoster(access.roster.source_type),
        engagement_type: engagement,
        package_lesson_count: data.packageLessonCount ?? null,
        converted_enquiry_ref: data.convertedEnquiryRef ?? null,
      })
      .select("id")
      .single();
    if (error) {
      // Race with a concurrent add: the unique index is the backstop.
      if (/duplicate|unique/i.test(error.message ?? "")) {
        const raced = await selectRows<{ id: string; link_status: string }>(
          db,
          "roster_students",
          "id, link_status",
          [
            { col: "roster_id", op: "eq", value: access.roster.id },
            { col: "parent_contact_normalized", op: "eq", value: contact },
            { col: "display_name_normalized", op: "eq", value: nameNormalized },
          ],
        );
        if (raced[0]) {
          return {
            ok: true,
            studentId: raced[0].id,
            linkStatus: raced[0].link_status === "linked" ? "linked" : "pending_link",
            duplicate: true,
          };
        }
      }
      throw new Error(error.message);
    }
    return {
      ok: true,
      studentId: (inserted as unknown as { id: string }).id,
      linkStatus: accountId ? "linked" : "pending_link",
      duplicate: false,
    };
  });

// ---------------------------------------------------------------------------
// Educator: markers (§2 — centre courses MAY assign affiliated tutors)
// ---------------------------------------------------------------------------

export const assignRosterMarker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) =>
    z.object({ rosterId: z.string().uuid(), markerUserId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await rosterDb();
    const access = await requireRosterAccess(db, data.rosterId, context.userId, "manage");
    if (!access.roster.organization_id) throw new Error("MARKERS_CENTRE_ONLY");

    // #613: only an APPROVED affiliated tutor of this centre can be a marker
    // (centre_affiliations from #548).
    const affs = await selectRows<{ id: string }>(db, "centre_affiliations", "id", [
      { col: "user_id", op: "eq", value: data.markerUserId },
      { col: "centre_id", op: "eq", value: access.roster.organization_id },
      { col: "role_type", op: "eq", value: "affiliated_tutor" },
      { col: "status", op: "eq", value: "approved" },
    ]);
    if (affs.length === 0) throw new Error("MARKER_NOT_AFFILIATED");

    // Re-assigning a revoked marker reuses the row (unique index).
    const existing = await selectRows<RosterMarkerRow>(db, "roster_markers", "id", [
      { col: "roster_id", op: "eq", value: access.roster.id },
      { col: "marker_user_id", op: "eq", value: data.markerUserId },
    ]);
    if (existing[0]) {
      const { error } = await db
        .from("roster_markers")
        .update({ revoked_at: null })
        .eq("id", existing[0].id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await db.from("roster_markers").insert({
      roster_id: access.roster.id,
      marker_user_id: data.markerUserId,
      assigned_by_user_id: context.userId,
    });
    if (error && !/duplicate|unique/i.test(error.message ?? "")) throw new Error(error.message);
    return { ok: true };
  });

export const revokeRosterMarker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) =>
    z.object({ rosterId: z.string().uuid(), markerUserId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await rosterDb();
    await requireRosterAccess(db, data.rosterId, context.userId, "manage");
    // #613 §5: revoking a marker removes their permission to mark going
    // forward while preserving every historical log (rows keep
    // marked_by_user_id; nothing is deleted).
    const { error } = await db
      .from("roster_markers")
      .update({ revoked_at: new Date().toISOString() })
      .eq("roster_id", data.rosterId)
      .eq("marker_user_id", data.markerUserId)
      .eq("revoked_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Educator: unlink a claimed parent (§5 — claimed in error)
// ---------------------------------------------------------------------------

export const unlinkRosterParent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => z.object({ rosterStudentId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await rosterDb();
    const students = await selectRows<RosterStudentRow>(db, "roster_students", "*", [
      { col: "id", op: "eq", value: data.rosterStudentId },
    ]);
    const student = students[0];
    if (!student) throw new Error("STUDENT_NOT_FOUND");
    await requireRosterAccess(db, student.roster_id, context.userId, "manage");
    const { error } = await db
      .from("roster_students")
      .update({ link_status: "pending_link", linked_account_id: null })
      .eq("id", student.id)
      .eq("link_status", "linked");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Educator: 1-tap attendance (§3B)
// ---------------------------------------------------------------------------

const saveAttendanceInput = z.object({
  rosterId: z.string().uuid(),
  sessionKey: z.string().refine(isValidSessionKey, "SESSION_KEY_INVALID"),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "DATE_INVALID"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "TIME_INVALID"),
  sessionNote: z.string().max(MAX_SESSION_NOTE_LENGTH).optional(),
  marks: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        status: z.enum(ATTENDANCE_STATUSES),
      }),
    )
    .min(1)
    .max(200),
});

export type SaveAttendanceResult = {
  ok: true;
  sessionId: string;
  /** True when this save hit the idempotency key (double-tap). */
  duplicate: boolean;
  notified: number;
};

export const saveAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => saveAttendanceInput.parse(input))
  .handler(async ({ context, data }): Promise<SaveAttendanceResult> => {
    const db = await rosterDb();
    const access = await requireRosterAccess(db, data.rosterId, context.userId, "mark");

    // Idempotency: a repeat save (double-tap, retry) resolves to the SAME
    // session — one session, one notification batch, zero extra counters.
    const existingSessions = await selectRows<RosterSessionRow>(db, "roster_sessions", "*", [
      { col: "roster_id", op: "eq", value: access.roster.id },
      { col: "session_key", op: "eq", value: data.sessionKey },
    ]);
    if (existingSessions[0]) {
      return { ok: true, sessionId: existingSessions[0].id, duplicate: true, notified: 0 };
    }

    const students = await selectRows<RosterStudentRow>(db, "roster_students", "*", [
      { col: "roster_id", op: "eq", value: access.roster.id },
    ]);
    const studentById = new Map(students.map((s) => [s.id, s]));

    // Dedupe repeated students inside one payload; every id must belong.
    const seen = new Set<string>();
    const marks: { studentId: string; status: AttendanceStatus }[] = [];
    for (const m of data.marks) {
      if (!studentById.has(m.studentId)) throw new Error("STUDENT_NOT_IN_ROSTER");
      if (seen.has(m.studentId)) continue;
      seen.add(m.studentId);
      marks.push(m);
    }

    let courseTitle = access.roster.title;
    if (access.roster.course_id) {
      const courses = await selectRows<{ title: string }>(db, "courses", "title", [
        { col: "id", op: "eq", value: access.roster.course_id },
      ]);
      if (courses[0]?.title) courseTitle = courses[0].title;
    }

    // Insert the session first: the (roster_id, session_key) unique index is
    // the race backstop for two simultaneous saves.
    const { data: sessionInserted, error: sessionError } = await db
      .from<RosterSessionRow>("roster_sessions")
      .insert({
        roster_id: access.roster.id,
        session_key: data.sessionKey,
        session_date: data.sessionDate,
        start_time: data.startTime,
        session_note: data.sessionNote?.trim() ? data.sessionNote.trim() : null,
        marker_user_id: context.userId,
        status: "completed",
      })
      .select("id")
      .single();
    if (sessionError) {
      if (/duplicate|unique/i.test(sessionError.message ?? "")) {
        const raced = await selectRows<RosterSessionRow>(db, "roster_sessions", "id", [
          { col: "roster_id", op: "eq", value: access.roster.id },
          { col: "session_key", op: "eq", value: data.sessionKey },
        ]);
        if (raced[0]) {
          return { ok: true, sessionId: raced[0].id, duplicate: true, notified: 0 };
        }
      }
      throw new Error(sessionError.message);
    }
    const sessionId = (sessionInserted as unknown as { id: string }).id;

    let notified = 0;
    for (const m of marks) {
      const student = studentById.get(m.studentId)!;
      const { data: attInserted, error: attError } = await db
        .from<RosterAttendanceRow>("roster_attendance")
        .insert({
          session_id: sessionId,
          roster_id: access.roster.id,
          roster_student_id: student.id,
          status: m.status,
          marked_by_user_id: context.userId,
        })
        .select("id")
        .single();
      if (attError) throw new Error(attError.message);
      const attendanceId = (attInserted as unknown as { id: string }).id;

      // PRESENT + LATE increment the cumulative completed count; ABSENT_* +0.
      const delta = m.status === "present" || m.status === "late" ? 1 : 0;
      if (delta !== 0) {
        const { error: cntError } = await db
          .from("roster_students")
          .update({
            completed_lesson_count: Number(student.completed_lesson_count ?? 0) + delta,
          })
          .eq("id", student.id);
        if (cntError) throw new Error(cntError.message);
      }

      // Structured event per student (the #614 bell drains it; parents with a
      // linked account are payload-addressed recipients).
      if (student.linked_account_id) {
        await emitAttendanceEvent(
          db,
          "attendance.recorded",
          {
            roster_id: access.roster.id,
            session_id: sessionId,
            attendance_id: attendanceId,
            student_name: student.display_name,
            status: m.status,
            course_title: courseTitle,
            session_date: data.sessionDate,
            recipient_account_id: student.linked_account_id,
            context: "learning",
          },
          attendanceId,
        );
        notified += 1;
      }
    }

    return { ok: true, sessionId, duplicate: false, notified };
  });

// ---------------------------------------------------------------------------
// Educator: edit within the 24h window (§3B + §5) + optimistic concurrency
// ---------------------------------------------------------------------------

const editAttendanceInput = z.object({
  attendanceId: z.string().uuid(),
  toStatus: z.enum(ATTENDANCE_STATUSES),
  baseUpdatedAt: z.string().min(10),
});

export type EditAttendanceResult = { ok: true; updatedAt: string };

export const editAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => editAttendanceInput.parse(input))
  .handler(async ({ context, data }): Promise<EditAttendanceResult> => {
    const db = await rosterDb();
    const attendanceRows = await selectRows<RosterAttendanceRow>(db, "roster_attendance", "*", [
      { col: "id", op: "eq", value: data.attendanceId },
    ]);
    const record = attendanceRows[0];
    if (!record) throw new Error("ATTENDANCE_NOT_FOUND");
    if (record.voided_at) throw new Error("ATTENDANCE_VOIDED");
    const access = await requireRosterAccess(db, record.roster_id, context.userId, "mark");

    // #613 §3B: corrections close 24h after marking; afterwards the record is
    // read-only (support handles manual adjustments).
    if (!canCorrectAttendance(record.created_at, new Date())) {
      throw new Error("ATTENDANCE_LOCKED");
    }
    // #613 §5: two markers on one session — the second save prompts refresh.
    if (isStaleVersion(data.baseUpdatedAt, record.updated_at)) {
      throw new Error("ATTENDANCE_STALE");
    }
    if (record.status === data.toStatus) {
      return { ok: true, updatedAt: record.updated_at };
    }

    const students = await selectRows<RosterStudentRow>(db, "roster_students", "*", [
      { col: "id", op: "eq", value: record.roster_student_id },
    ]);
    const student = students[0];
    if (!student) throw new Error("STUDENT_NOT_FOUND");

    const nowIso = new Date().toISOString();
    // #387 predicate+rowCount race guard: the update only lands when the
    // version still matches; count 0 = another marker moved the row.
    const { count: edited, error } = await db
      .from("roster_attendance")
      .update({ status: data.toStatus, updated_at: nowIso }, { count: "exact" })
      .eq("id", record.id)
      .eq("updated_at", data.baseUpdatedAt);
    if (error) throw new Error(error.message);
    if (!edited) throw new Error("ATTENDANCE_STALE");

    // Present→Absent at hour 2 decrements; Absent→Present restores; both
    // audit-trailed.
    const delta = editCountDelta(record.status, data.toStatus);
    if (delta !== 0) {
      const { error: cntError } = await db
        .from("roster_students")
        .update({
          completed_lesson_count: Math.max(0, Number(student.completed_lesson_count ?? 0) + delta),
        })
        .eq("id", student.id);
      if (cntError) throw new Error(cntError.message);
    }

    const { error: auditError } = await db.from("roster_attendance_audit").insert({
      attendance_id: record.id,
      session_id: record.session_id,
      actor_user_id: context.userId,
      action: "edit",
      from_status: record.status,
      to_status: data.toStatus,
    });
    if (auditError) throw new Error(auditError.message);

    // [Attendance Updated] correction notice for the linked parent.
    if (student.linked_account_id) {
      await emitAttendanceEvent(
        db,
        "attendance.updated",
        {
          roster_id: record.roster_id,
          session_id: record.session_id,
          attendance_id: record.id,
          student_name: student.display_name,
          from_status: record.status,
          to_status: data.toStatus,
          voided: false,
          course_title: access.roster.title,
          recipient_account_id: student.linked_account_id,
          context: "learning",
        },
        record.id,
      );
    }

    return { ok: true, updatedAt: nowIso };
  });

// ---------------------------------------------------------------------------
// Educator: void a mistaken session inside the 24h window (§2b VOIDED)
// ---------------------------------------------------------------------------

const voidSessionInput = z.object({
  sessionId: z.string().uuid(),
  baseUpdatedAt: z.string().min(10),
});

export const voidSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => voidSessionInput.parse(input))
  .handler(async ({ context, data }): Promise<EditAttendanceResult> => {
    const db = await rosterDb();
    const sessionRows = await selectRows<RosterSessionRow>(db, "roster_sessions", "*", [
      { col: "id", op: "eq", value: data.sessionId },
    ]);
    const session = sessionRows[0];
    if (!session) throw new Error("SESSION_NOT_FOUND");
    const access = await requireRosterAccess(db, session.roster_id, context.userId, "mark");
    if (session.status === "voided") {
      return { ok: true, updatedAt: session.updated_at };
    }
    if (!canCorrectAttendance(session.created_at, new Date())) {
      throw new Error("ATTENDANCE_LOCKED");
    }
    if (isStaleVersion(data.baseUpdatedAt, session.updated_at)) {
      throw new Error("ATTENDANCE_STALE");
    }

    const attendanceRows = await selectRows<RosterAttendanceRow>(db, "roster_attendance", "*", [
      { col: "session_id", op: "eq", value: session.id },
      { col: "voided_at", op: "eq", value: null },
    ]);
    const studentIds = [...new Set(attendanceRows.map((a) => a.roster_student_id))];
    const students = studentIds.length
      ? await selectRows<RosterStudentRow>(db, "roster_students", "*", [
          { col: "id", op: "in", value: studentIds },
        ])
      : [];
    const studentById = new Map(students.map((s) => [s.id, s]));

    const nowIso = new Date().toISOString();
    // Unwind the completed counters first (voided sessions contribute 0).
    for (const a of attendanceRows) {
      if (a.status === "present" || a.status === "late") {
        const student = studentById.get(a.roster_student_id);
        if (student) {
          const { error: cntError } = await db
            .from("roster_students")
            .update({
              completed_lesson_count: Math.max(0, Number(student.completed_lesson_count ?? 0) - 1),
            })
            .eq("id", student.id);
          if (cntError) throw new Error(cntError.message);
        }
      }
      const { error: attError } = await db
        .from("roster_attendance")
        .update({ voided_at: nowIso, updated_at: nowIso })
        .eq("id", a.id)
        .eq("voided_at", null);
      if (attError) throw new Error(attError.message);
      const { error: auditError } = await db.from("roster_attendance_audit").insert({
        attendance_id: a.id,
        session_id: session.id,
        actor_user_id: context.userId,
        action: "void",
        from_status: a.status,
        to_status: null,
      });
      if (auditError) throw new Error(auditError.message);
      if (studentById.get(a.roster_student_id)?.linked_account_id) {
        const recipient = studentById.get(a.roster_student_id)?.linked_account_id ?? null;
        await emitAttendanceEvent(
          db,
          "attendance.updated",
          {
            roster_id: session.roster_id,
            session_id: session.id,
            attendance_id: a.id,
            student_name: studentById.get(a.roster_student_id)?.display_name ?? "",
            from_status: a.status,
            to_status: null,
            voided: true,
            course_title: access.roster.title,
            recipient_account_id: recipient,
            context: "learning",
          },
          a.id,
        );
      }
    }

    const { count: voided, error: sessionError } = await db
      .from("roster_sessions")
      .update({ status: "voided", voided_at: nowIso }, { count: "exact" })
      .eq("id", session.id)
      .eq("updated_at", data.baseUpdatedAt);
    if (sessionError) throw new Error(sessionError.message);
    if (!voided) throw new Error("ATTENDANCE_STALE");
    return { ok: true, updatedAt: nowIso };
  });

// ---------------------------------------------------------------------------
// Claim links (§3C Flow B): create / revoke — educator side
// ---------------------------------------------------------------------------

const claimLinkInput = z.object({ rosterStudentId: z.string().uuid() });

export type CreateClaimLinkResult = {
  ok: true;
  claimUrl: string;
  shareTextEn: string;
  shareTextZh: string;
  shareTextBoth: string;
  expiresAt: string;
};

export const createRosterClaimLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => claimLinkInput.parse(input))
  .handler(async ({ context, data }): Promise<CreateClaimLinkResult> => {
    const db = await rosterDb();
    const students = await selectRows<RosterStudentRow>(db, "roster_students", "*", [
      { col: "id", op: "eq", value: data.rosterStudentId },
    ]);
    const student = students[0];
    if (!student) throw new Error("STUDENT_NOT_FOUND");
    const access = await requireRosterAccess(db, student.roster_id, context.userId, "manage");
    if (student.link_status !== "pending_link") throw new Error("STUDENT_ALREADY_LINKED");

    // A regenerated link invalidates the previous unused one (single live
    // token per student, like the child-claim flow).
    const nowIso = new Date().toISOString();
    const { error: revokeError } = await db
      .from("roster_claim_tokens")
      .update({ revoked_at: nowIso })
      .eq("roster_student_id", student.id)
      .eq("used_at", null)
      .eq("revoked_at", null);
    if (revokeError) throw new Error(revokeError.message);

    const raw = generateRawToken();
    const expiresAt = new Date(Date.now() + CLAIM_TOKEN_DAYS * 86_400_000).toISOString();
    const { error } = await db.from("roster_claim_tokens").insert({
      roster_student_id: student.id,
      created_by_user_id: context.userId,
      token_hash: hashToken(raw),
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);

    const claimUrl = `${SITE_URL}/claim-roster/${raw}`;
    let courseTitle = access.roster.title;
    if (access.roster.course_id) {
      const courses = await selectRows<{ title: string }>(db, "courses", "title", [
        { col: "id", op: "eq", value: access.roster.course_id },
      ]);
      if (courses[0]?.title) courseTitle = courses[0].title;
    }
    const input = { courseName: courseTitle, studentName: student.display_name, claimUrl };
    return {
      ok: true,
      claimUrl,
      shareTextEn: buildShareTextEn(input),
      shareTextZh: buildShareTextZh(input),
      shareTextBoth: buildShareTextBoth(input),
      expiresAt,
    };
  });

export const revokeRosterClaimLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => claimLinkInput.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await rosterDb();
    const students = await selectRows<RosterStudentRow>(db, "roster_students", "*", [
      { col: "id", op: "eq", value: data.rosterStudentId },
    ]);
    const student = students[0];
    if (!student) throw new Error("STUDENT_NOT_FOUND");
    await requireRosterAccess(db, student.roster_id, context.userId, "manage");
    const { error } = await db
      .from("roster_claim_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("roster_student_id", student.id)
      .eq("used_at", null)
      .eq("revoked_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Parent claim (§3C + §4.3): preview is public; confirm needs a parent login
// ---------------------------------------------------------------------------

export type ClaimPreviewState = "valid" | "used" | "revoked" | "expired" | "not_found";

export type ClaimPreview = {
  state: ClaimPreviewState;
  educatorName: string | null;
  studentName: string | null;
  courseTitle: string | null;
  /** Always HK$0 — parent accounts are free (Cap.57 display only). */
  feeHkd: 0;
};

export const getRosterClaimPreview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10).max(200) }).parse(input))
  .handler(async ({ data }): Promise<ClaimPreview> => {
    const db = await rosterDb();
    const tokens = await selectRows<RosterClaimTokenRow>(db, "roster_claim_tokens", "*", [
      { col: "token_hash", op: "eq", value: hashToken(data.token) },
    ]);
    const token = tokens[0];
    if (!token) {
      return {
        state: "not_found",
        educatorName: null,
        studentName: null,
        courseTitle: null,
        feeHkd: 0,
      };
    }
    const state = claimTokenState(token, new Date());

    const students = await selectRows<RosterStudentRow>(db, "roster_students", "*", [
      { col: "id", op: "eq", value: token.roster_student_id },
    ]);
    const student = students[0];
    if (!student) {
      return {
        state: "not_found",
        educatorName: null,
        studentName: null,
        courseTitle: null,
        feeHkd: 0,
      };
    }
    const rosters = await selectRows<RosterRow>(db, "rosters", "*", [
      { col: "id", op: "eq", value: student.roster_id },
    ]);
    const roster = rosters[0];
    let courseTitle = roster?.title ?? null;
    if (roster?.course_id) {
      const courses = await selectRows<{ title: string }>(db, "courses", "title", [
        { col: "id", op: "eq", value: roster.course_id },
      ]);
      if (courses[0]?.title) courseTitle = courses[0].title;
    }
    const educators = roster
      ? await selectRows<{ display_name: string | null }>(db, "profiles", "display_name", [
          { col: "id", op: "eq", value: roster.owner_user_id },
        ])
      : [];

    return {
      state,
      educatorName: educators[0]?.display_name ?? null,
      studentName: student.display_name,
      courseTitle,
      feeHkd: 0,
    };
  });

export type ClaimHistoryItem = { sessionDate: string; status: AttendanceStatus };

export type ConfirmClaimResult = {
  ok: true;
  studentName: string;
  /** Historical records the parent immediately sees on the success card. */
  history: ClaimHistoryItem[];
  backfilled: number;
};

export const confirmRosterClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10).max(200) }).parse(input))
  .handler(async ({ context, data }): Promise<ConfirmClaimResult> => {
    const db = await rosterDb();
    const tokens = await selectRows<RosterClaimTokenRow>(db, "roster_claim_tokens", "*", [
      { col: "token_hash", op: "eq", value: hashToken(data.token) },
    ]);
    const token = tokens[0];
    if (!token) throw new Error("CLAIM_INVALID");
    const state = claimTokenState(token, new Date());
    if (state !== "valid") throw new Error(`CLAIM_${state.toUpperCase()}`);

    const students = await selectRows<RosterStudentRow>(db, "roster_students", "*", [
      { col: "id", op: "eq", value: token.roster_student_id },
    ]);
    const student = students[0];
    if (!student) throw new Error("CLAIM_INVALID");
    if (student.link_status === "linked") throw new Error("CLAIM_USED");

    const rosters = await selectRows<RosterRow>(db, "rosters", "*", [
      { col: "id", op: "eq", value: student.roster_id },
    ]);
    const roster = rosters[0];
    if (!roster) throw new Error("CLAIM_INVALID");

    // #613 §3C: the educator who created the roster can never claim their own
    // student's parent link.
    if (context.userId === roster.owner_user_id || context.userId === token.created_by_user_id) {
      throw new Error("CLAIM_SELF_EDUCATOR");
    }

    const nowIso = new Date().toISOString();
    // Consume the token first — one-time semantics ride on used_at IS NULL,
    // so two simultaneous claims cannot both proceed (race guard).
    const { count: consumed, error: consumeError } = await db
      .from("roster_claim_tokens")
      .update({ used_at: nowIso, used_by_user_id: context.userId }, { count: "exact" })
      .eq("id", token.id)
      .eq("used_at", null)
      .eq("revoked_at", null);
    if (consumeError) throw new Error(consumeError.message);
    if (!consumed) throw new Error("CLAIM_INVALID");

    const { error: linkError } = await db
      .from("roster_students")
      .update({ link_status: "linked", linked_account_id: context.userId })
      .eq("id", student.id)
      .eq("link_status", "pending_link");
    if (linkError) throw new Error(linkError.message);

    // §3C/§5: past + queued records attach — the new parent immediately sees
    // the historical attendance (success card) and gets the notifications
    // (backfilled events) without waiting for the next lesson.
    let courseTitle = roster.title;
    if (roster.course_id) {
      const courses = await selectRows<{ title: string }>(db, "courses", "title", [
        { col: "id", op: "eq", value: roster.course_id },
      ]);
      if (courses[0]?.title) courseTitle = courses[0].title;
    }
    const historyRows = await selectRows<RosterAttendanceRow>(
      db,
      "roster_attendance",
      "*",
      [
        { col: "roster_student_id", op: "eq", value: student.id },
        { col: "voided_at", op: "eq", value: null },
      ],
      { col: "created_at", asc: false, limit: 50 },
    );
    const sessionIds = [...new Set(historyRows.map((r) => r.session_id))];
    const sessionsById = new Map<string, RosterSessionRow>();
    if (sessionIds.length > 0) {
      const sessionRows = await selectRows<RosterSessionRow>(db, "roster_sessions", "*", [
        { col: "id", op: "in", value: sessionIds },
        { col: "status", op: "eq", value: "completed" },
      ]);
      for (const s of sessionRows) sessionsById.set(s.id, s);
    }
    const live = historyRows.filter((r) => sessionsById.has(r.session_id));
    let backfilled = 0;
    for (const r of live) {
      const session = sessionsById.get(r.session_id)!;
      await emitAttendanceEvent(
        db,
        "attendance.recorded",
        {
          roster_id: roster.id,
          session_id: session.id,
          attendance_id: r.id,
          student_name: student.display_name,
          status: r.status,
          course_title: courseTitle,
          session_date: session.session_date,
          recipient_account_id: context.userId,
          context: "learning",
        },
        r.id,
      );
      backfilled += 1;
    }

    return {
      ok: true,
      studentName: student.display_name,
      history: live.slice(0, 20).map((r) => ({
        sessionDate: sessionsById.get(r.session_id)!.session_date,
        status: r.status,
      })),
      backfilled,
    };
  });

// ---------------------------------------------------------------------------
// Centre admin: pick an affiliated tutor to assign as a marker
// ---------------------------------------------------------------------------

export type AffiliatedTutor = { userId: string; name: string | null };

export const listAffiliatedTutors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => z.object({ organizationId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ tutors: AffiliatedTutor[] }> => {
    const db = await rosterDb();
    if (!(await isOrgAdmin(db, data.organizationId, context.userId))) {
      throw new Error("ROSTER_FORBIDDEN");
    }
    const affs = await selectRows<{ user_id: string }>(db, "centre_affiliations", "user_id", [
      { col: "centre_id", op: "eq", value: data.organizationId },
      { col: "role_type", op: "eq", value: "affiliated_tutor" },
      { col: "status", op: "eq", value: "approved" },
    ]);
    if (affs.length === 0) return { tutors: [] };
    const profiles = await selectRows<{ id: string; display_name: string | null }>(
      db,
      "profiles",
      "id, display_name",
      [{ col: "id", op: "in", value: [...new Set(affs.map((a) => a.user_id))] }],
    );
    const nameById = new Map(profiles.map((p) => [p.id, p.display_name]));
    return {
      tutors: [...new Set(affs.map((a) => a.user_id))].map((userId) => ({
        userId,
        name: nameById.get(userId) ?? null,
      })),
    };
  });

// ---------------------------------------------------------------------------
// Claim page viewer state (#613 §4.3): the signed-in educator sees the
// Preview Mode banner + a blocked self-claim, so the page needs to know
// whether the CURRENT viewer owns this roster (auth'd fn; the public
// preview above stays anonymous).
// ---------------------------------------------------------------------------

export const getRosterClaimViewerState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10).max(200) }).parse(input))
  .handler(async ({ context, data }): Promise<{ isEducator: boolean }> => {
    const db = await rosterDb();
    const tokens = await selectRows<RosterClaimTokenRow>(db, "roster_claim_tokens", "*", [
      { col: "token_hash", op: "eq", value: hashToken(data.token) },
    ]);
    const token = tokens[0];
    if (!token) return { isEducator: false };
    const students = await selectRows<{ roster_id: string }>(db, "roster_students", "roster_id", [
      { col: "id", op: "eq", value: token.roster_student_id },
    ]);
    const rosterId = students[0]?.roster_id;
    if (!rosterId) return { isEducator: false };
    const rosters = await selectRows<{ owner_user_id: string }>(db, "rosters", "owner_user_id", [
      { col: "id", op: "eq", value: rosterId },
    ]);
    return { isEducator: rosters[0]?.owner_user_id === context.userId };
  });
