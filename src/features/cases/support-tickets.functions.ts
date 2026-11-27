/**
 * Issue #816 §2.3 (AC-260-1/2/3) — case support tickets, server half.
 *
 * The contract the desk and the case parties share:
 *   * one OPEN ticket per case (partial unique index, 23505 mapped to
 *     TICKET_EXISTS), so a parent cannot fan out duplicates;
 *   * only the case's own parties (parent / tutor), the parent of record, an
 *     active centre member, or the desk can open one;
 *   * staff replies reject contact details, and never create a back channel;
 *   * a no-show ticket is a report. Nothing in this file writes case_fees,
 *     fee_collected_* or any other fee table.
 *
 * Reads and writes are service-role only; the ticket tables have RLS enabled
 * with no policies (migration 20261127140000).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  insertAudit,
  requireDeskStaff,
  selectRows,
  type Db,
  type Row,
} from "@/features/cases/desk-db";
import { partyCase } from "@/features/cases/case-schedule.functions";
import {
  TICKET_NOTE_MAX,
  TICKET_REASONS,
  isMissingRelation,
  partyTicketAuthorRole,
  replyError,
  ticketInputError,
  ticketIsOpen,
  type TicketAuthorRole,
  type TicketReason,
} from "@/features/cases/support-tickets";
import { hasContactDetails } from "@/lib/contact-filter";

export type { TicketAuthorRole };
export type TicketStatus = "open" | "resolved" | "closed";

export type CaseSupportTicketMessage = {
  id: string;
  authorId: string | null;
  authorRole: TicketAuthorRole;
  body: string;
  createdAt: string;
};

export type CaseSupportTicket = {
  id: string;
  caseId: string;
  openedByRole: TicketAuthorRole;
  reason: TicketReason;
  note: string | null;
  status: TicketStatus;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: CaseSupportTicketMessage[];
};

export type CaseTicketsResult = {
  /** false = migration 20261127140000 has not been applied here yet. */
  available: boolean;
  open: CaseSupportTicket | null;
  closed: CaseSupportTicket[];
};

type TicketDbRow = {
  id: string;
  case_id: string;
  opened_by_role: string;
  reason: string;
  note: string | null;
  status: string;
  resolution: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type MessageDbRow = {
  id: string;
  ticket_id: string;
  author_id: string | null;
  author_role: string;
  body: string;
  created_at: string;
};

const TICKET_COLUMNS =
  "id, case_id, opened_by_role, reason, note, status, resolution, resolved_at, created_at, updated_at";
const MESSAGE_COLUMNS = "id, ticket_id, author_id, author_role, body, created_at";

const OPEN_STATUS = "open";
const CLOSED_STATUSES = ["resolved", "closed"];

/** Browser client is never used; every query is service-role. */
async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

/**
 * The ticket tables land with migration 20261127140000. Until they exist, a
 * missing relation is a quiet "not available" state, never a 500 on the desk.
 */
async function guardMissingTable<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isMissingRelation(error)) throw new Error("TICKETS_UNAVAILABLE");
    throw error;
  }
}

/** Insert results resolve with an error object instead of throwing. */
function throwIfUnavailable(error: { code?: string; message: string } | null): void {
  if (!error) return;
  if (isMissingRelation(error)) throw new Error("TICKETS_UNAVAILABLE");
  throw new Error(error.message);
}

/**
 * AC-260-3: a parent of record can open a ticket before the case has a
 * matched tutor, which is exactly the window `partyCase` refuses (it needs
 * matched_tutor_id). Read service-role, never client-supplied.
 */
async function isParentOfRecord(db: Db, caseId: string, userId: string): Promise<boolean> {
  const rows = await selectRows<{ parent_id: string | null }>(db, "tutoring_cases", "parent_id", [
    { col: "id", op: "eq", value: caseId },
  ]);
  return rows[0]?.parent_id === userId;
}

/**
 * AC-260 §2.3 also names the centre contact: an active member of the
 * organisation that owns the case is a party for ticket purposes. Same query
 * shape as centre-case.functions.ts (org + user + active), read service-role.
 */
async function isCentreMember(db: Db, caseId: string, userId: string): Promise<boolean> {
  const rows = await selectRows<{ organisation_id: string | null }>(
    db,
    "tutoring_cases",
    "organisation_id",
    [{ col: "id", op: "eq", value: caseId }],
  );
  const organisationId = rows[0]?.organisation_id;
  if (!organisationId) return false;
  const members = await selectRows<{ id: string }>(
    db,
    "organization_members",
    "id",
    [
      { col: "organization_id", op: "eq", value: organisationId },
      { col: "user_id", op: "eq", value: userId },
      { col: "status", op: "eq", value: "active" },
    ],
    { col: "id", limit: 1 },
  );
  return members.length > 0;
}

/**
 * Who is acting on this case's ticket, and the role stored on anything they
 * write. The order is fixed (#816 §2.3): party, parent of record, active
 * centre member, desk staff. The desk check runs last, so staff who are also a
 * party keep the party role instead of being relabelled.
 */
async function resolveTicketActor(
  db: Db,
  caseId: string,
  userId: string,
  options: { allowDesk: boolean },
): Promise<TicketAuthorRole> {
  try {
    const party = await partyCase(db, caseId, userId);
    return partyTicketAuthorRole(party.role);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message !== "CASE_NOT_FOUND") throw error;
  }
  if (await isParentOfRecord(db, caseId, userId)) return partyTicketAuthorRole("parent");
  if (await isCentreMember(db, caseId, userId)) return partyTicketAuthorRole("centre");
  if (options.allowDesk) {
    await requireDeskStaff(db, userId);
    return partyTicketAuthorRole("staff");
  }
  throw new Error("FORBIDDEN");
}

/**
 * case_audit.to_status is rendered raw by the desk timeline, so it must be a
 * real case status, never a support-ticket pseudo-status (CsBackupsPanel
 * precedent). The ticket event itself is carried by `reason`.
 */
async function caseStatus(db: Db, caseId: string): Promise<string> {
  const rows = await selectRows<{ status: string | null }>(db, "tutoring_cases", "status", [
    { col: "id", op: "eq", value: caseId },
  ]);
  const status = rows[0]?.status;
  if (!status) throw new Error("CASE_NOT_FOUND");
  return status;
}

function toTicket(row: TicketDbRow, messages: CaseSupportTicketMessage[]): CaseSupportTicket {
  return {
    id: row.id,
    caseId: row.case_id,
    openedByRole: row.opened_by_role as TicketAuthorRole,
    // The table's check constraint is the authority on these two unions.
    reason: row.reason as TicketReason,
    note: row.note,
    status: row.status as TicketStatus,
    resolution: row.resolution,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages,
  };
}

async function loadMessages(
  db: Db,
  ticketIds: string[],
): Promise<Map<string, CaseSupportTicketMessage[]>> {
  const byTicket = new Map<string, CaseSupportTicketMessage[]>();
  if (ticketIds.length === 0) return byTicket;
  const rows = await selectRows<MessageDbRow>(
    db,
    "case_support_ticket_messages",
    MESSAGE_COLUMNS,
    [{ col: "ticket_id", op: "in", value: ticketIds }],
    { col: "created_at", asc: true },
  );
  for (const row of rows) {
    const list = byTicket.get(row.ticket_id) ?? [];
    list.push({
      id: row.id,
      authorId: row.author_id,
      authorRole: row.author_role as TicketAuthorRole,
      body: row.body,
      createdAt: row.created_at,
    });
    byTicket.set(row.ticket_id, list);
  }
  return byTicket;
}

async function loadTicket(db: Db, ticketId: string): Promise<TicketDbRow> {
  const rows = await selectRows<TicketDbRow>(db, "case_support_tickets", TICKET_COLUMNS, [
    { col: "id", op: "eq", value: ticketId },
  ]);
  const row = rows[0];
  if (!row) throw new Error("TICKET_NOT_FOUND");
  return row;
}

// ---------------------------------------------------------------------------
// Open a ticket (case parties, or the desk on their behalf)
// ---------------------------------------------------------------------------
export const openCaseTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        caseId: z.string().uuid(),
        reason: z.enum(TICKET_REASONS),
        // No max here: ticketInputError returns NOTE_TOO_LONG, one vocabulary for
        // the panel and the server.
        note: z.string().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ticketId: string }> => {
    const db = await adminDb();

    // AC-260-3: parties, the parent of record, the centre contact, then the
    // desk opening on their behalf. Throws FORBIDDEN for anyone else.
    const openedByRole = await resolveTicketActor(db, data.caseId, context.userId, {
      allowDesk: true,
    });

    const inputError = ticketInputError({ reason: data.reason, note: data.note });
    if (inputError) throw new Error(inputError);

    const note = (data.note ?? "").trim() || null;

    // AC-260-1: cheaper pre-check for the normal path; the partial unique index
    // is the real guard and 23505 below is the race.
    const open = await guardMissingTable(() =>
      selectRows<{ id: string }>(db, "case_support_tickets", "id", [
        { col: "case_id", op: "eq", value: data.caseId },
        { col: "status", op: "eq", value: OPEN_STATUS },
      ]),
    );
    if (open.length > 0) throw new Error("TICKET_EXISTS");

    const { data: created, error } = await db
      .from<Row>("case_support_tickets")
      .insert({
        case_id: data.caseId,
        opened_by: context.userId,
        opened_by_role: openedByRole,
        reason: data.reason,
        note,
      })
      .select("id")
      .single();
    if (error) {
      if (isMissingRelation(error)) throw new Error("TICKETS_UNAVAILABLE");
      if (error.code === "23505") throw new Error("TICKET_EXISTS");
      if (error.code === "23503") throw new Error("CASE_NOT_FOUND");
      throw new Error(error.message);
    }

    // Bookkeeping, not the ticket itself: a failed audit row must not lose it.
    try {
      await insertAudit(
        db,
        data.caseId,
        context.userId,
        await caseStatus(db, data.caseId),
        `[#816] support ticket opened: ${data.reason}`,
      );
    } catch (auditError) {
      console.warn(
        "[support-tickets] audit insert failed:",
        auditError instanceof Error ? auditError.message : auditError,
      );
    }

    return { ticketId: String(created.id) };
  });

// ---------------------------------------------------------------------------
// Read: the open ticket plus the last 20 closed ones, newest first
// ---------------------------------------------------------------------------
async function loadCaseTickets(db: Db, caseId: string): Promise<CaseTicketsResult> {
  try {
    const [openRows, closedRows] = await Promise.all([
      selectRows<TicketDbRow>(
        db,
        "case_support_tickets",
        TICKET_COLUMNS,
        [
          { col: "case_id", op: "eq", value: caseId },
          { col: "status", op: "eq", value: OPEN_STATUS },
        ],
        { col: "created_at", asc: false, limit: 1 },
      ),
      selectRows<TicketDbRow>(
        db,
        "case_support_tickets",
        TICKET_COLUMNS,
        [
          { col: "case_id", op: "eq", value: caseId },
          { col: "status", op: "in", value: CLOSED_STATUSES },
        ],
        { col: "created_at", asc: false, limit: 20 },
      ),
    ]);

    const messages = await loadMessages(
      db,
      [...openRows, ...closedRows].map((r) => r.id),
    );

    return {
      available: true,
      open: openRows[0] ? toTicket(openRows[0], messages.get(openRows[0].id) ?? []) : null,
      closed: closedRows.map((row) => toTicket(row, messages.get(row.id) ?? [])),
    };
  } catch (error) {
    if (isMissingRelation(error)) return { available: false, open: null, closed: [] };
    throw error;
  }
}

/** Desk read: the same payload, staff-gated. */
export const listCaseTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<CaseTicketsResult> => {
    const db = await adminDb();
    await requireDeskStaff(db, context.userId);
    return loadCaseTickets(db, data.caseId);
  });

/**
 * Party read (#816 §2.3): a parent, tutor, active centre member or the desk
 * sees their own case's ticket. The missing-relation degradation is the same
 * one the desk gets, so a pre-migration environment shows a quiet line, never
 * a 500.
 */
export const getMyCaseTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<CaseTicketsResult> => {
    const db = await adminDb();
    await resolveTicketActor(db, data.caseId, context.userId, { allowDesk: true });
    return loadCaseTickets(db, data.caseId);
  });

// ---------------------------------------------------------------------------
// Staff reply. Contact details are rejected in code, before the insert.
// ---------------------------------------------------------------------------
export const replyToTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ ticketId: z.string().uuid(), body: z.string() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ messageId: string }> => {
    const db = await adminDb();
    await requireDeskStaff(db, context.userId);

    const error = replyError(data.body);
    if (error) throw new Error(error);

    const ticket = await guardMissingTable(() => loadTicket(db, data.ticketId));
    if (ticket.status !== OPEN_STATUS) throw new Error("TICKET_NOT_OPEN");

    const { data: created, error: insertError } = await db
      .from<Row>("case_support_ticket_messages")
      .insert({
        ticket_id: data.ticketId,
        author_id: context.userId,
        author_role: "staff",
        body: data.body.trim(),
      })
      .select("id")
      .single();
    throwIfUnavailable(insertError);

    const { error: bumpError } = await db
      .from<Row>("case_support_tickets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.ticketId);
    if (bumpError) {
      console.warn("[support-tickets] updated_at bump failed:", bumpError.message);
    }

    return { messageId: String(created.id) };
  });

// ---------------------------------------------------------------------------
// Party reply: the same open ticket, written from the family or tutor side.
// Contact details are rejected here too, so the thread never becomes a
// back channel.
// ---------------------------------------------------------------------------
export const postTicketMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ ticketId: z.string().uuid(), body: z.string() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ messageId: string }> => {
    const db = await adminDb();

    // A missing relation is TICKETS_UNAVAILABLE, never a message on a ghost.
    const ticket = await guardMissingTable(() => loadTicket(db, data.ticketId));
    const authorRole = await resolveTicketActor(db, ticket.case_id, context.userId, {
      allowDesk: true,
    });

    if (!ticketIsOpen(ticket.status)) throw new Error("TICKET_CLOSED");

    const error = replyError(data.body);
    if (error) throw new Error(error);

    const { data: created, error: insertError } = await db
      .from<Row>("case_support_ticket_messages")
      .insert({
        ticket_id: data.ticketId,
        author_id: context.userId,
        author_role: authorRole,
        body: data.body.trim(),
      })
      .select("id")
      .single();
    throwIfUnavailable(insertError);

    const { error: bumpError } = await db
      .from<Row>("case_support_tickets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.ticketId);
    if (bumpError) {
      console.warn("[support-tickets] updated_at bump failed:", bumpError.message);
    }

    return { messageId: String(created.id) };
  });

// ---------------------------------------------------------------------------
// Desk resolve / close. A resolution is optional; like the note it is capped
// at 500 characters (schema constraint).
// ---------------------------------------------------------------------------
export const resolveTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        ticketId: z.string().uuid(),
        resolution: z.string().optional().nullable(),
        nextStatus: z.enum(["resolved", "closed"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ticketId: string; status: TicketStatus }> => {
    const db = await adminDb();
    await requireDeskStaff(db, context.userId);

    const resolution = (data.resolution ?? "").trim();
    if (resolution.length > TICKET_NOTE_MAX) throw new Error("RESOLUTION_TOO_LONG");
    // AC-260-2: the resolution is staff-authored free text on a party-visible
    // record, so it gets the same contact filter as a reply.
    if (hasContactDetails(resolution)) throw new Error("CONTACT_DETAILS");

    const ticket = await guardMissingTable(() => loadTicket(db, data.ticketId));
    if (ticket.status !== OPEN_STATUS) throw new Error("TICKET_NOT_OPEN");

    const { error } = await db
      .from<Row>("case_support_tickets")
      .update({
        status: data.nextStatus,
        resolution: resolution || null,
        resolved_by: context.userId,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.ticketId);
    throwIfUnavailable(error);

    try {
      await insertAudit(
        db,
        ticket.case_id,
        context.userId,
        await caseStatus(db, ticket.case_id),
        `[#816] support ticket ${data.nextStatus}: ${ticket.reason}`,
      );
    } catch (auditError) {
      console.warn(
        "[support-tickets] audit insert failed:",
        auditError instanceof Error ? auditError.message : auditError,
      );
    }

    return { ticketId: data.ticketId, status: data.nextStatus };
  });
