/**
 * #617 Tutor Connections server functions (Child A of the Tutor Connect
 * epic, Airbnb pattern). All reads/writes require a signed-in account whose
 * tutors row is verification_tier === "tier_2_verified" (the repo's
 * ACTIVE_VERIFIED convention — see features/materials/queries.ts #314).
 *
 * Contact privacy: serializers expose ONLY public tutor fields
 * (display_name / photo / tutor_code / subjects / district / curricula /
 * verified badge) and never phone, WhatsApp or email. The optional intro
 * note is regex-stripped server-side by sanitizeIntroNote before it is
 * stored (tutor_connections.intro_note_sanitized).
 *
 * Notifications ride the #205 bus: connect.request / connect.accepted land
 * in case_events and the lazy drain delivers the in-app bell item
 * (delivery plan in features/cases/bus.ts).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb, type AdminDb } from "@/features/materials/storage-helpers";
import {
  CONNECTION_STATUSES,
  countOutboundRequests24h,
  decideRequest,
  declineCooldownUntil,
  extractCurricula,
  gateOutbound,
  isConnectIntentTag,
  sanitizeIntroNote,
  tutorPairFilter,
  type ConnectIntentTag,
  type ConnectionStatus,
  type ExistingEdge,
} from "@/features/connections/connections-pure";
import { matchesCategoryFilter, matchesSubjectQuery } from "@/features/tutors/subjects";

type Row = Record<string, unknown>;

/** Public tutor fields the connection serializers may return. NEVER add
 * contact columns here — #617 hard rule. */
export type ConnectionTutorPublic = {
  id: string;
  display_name: string;
  photo_url: string | null;
  tutor_code: string;
  subjects: string[];
  district: string | null;
  verification_tier: string | null;
  is_published: boolean | null;
  curricula: string[];
};

export type ConnectionItem = {
  id: string;
  status: ConnectionStatus;
  direction: "outbound" | "inbound";
  counterpart: ConnectionTutorPublic;
  intentTag: ConnectIntentTag;
  introNote: string | null;
  cooldownUntil: string | null;
  createdAt: string;
  respondedAt: string | null;
};

export type ConnectionFindTutor = ConnectionTutorPublic & {
  /** Edge state with the viewer, so the UI can dim/label candidates. */
  viewerStatus: "none" | ConnectionStatus;
  viewerDirection: "outbound" | "inbound" | null;
};

const TUTOR_PUBLIC_COLS =
  "id, display_name, tutor_code, photo_url, subjects, district, verification_tier, is_published, pricing_tiers";

type TutorDbRow = {
  id: string;
  display_name: string;
  tutor_code: string;
  photo_url: string | null;
  subjects: string[] | null;
  district: string | null;
  verification_tier: string | null;
  is_published: boolean | null;
  pricing_tiers: unknown;
};

/** Errors thrown toward the client are i18n keys under connections.error.* */
function fail(key: string): never {
  throw new Error(key);
}

async function getMyTutorRow(db: AdminDb, userId: string): Promise<TutorDbRow | null> {
  const { data } = await db
    .from<TutorDbRow>("tutors")
    .select(
      "id, user_id, display_name, tutor_code, photo_url, subjects, district, verification_tier, is_published, pricing_tiers",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

/** ACTIVE_VERIFIED gate: tier_2_verified (repo convention, #314). */
export function isVerifiedTutor(tutor: { verification_tier: string | null } | null): boolean {
  return tutor?.verification_tier === "tier_2_verified";
}

async function requireVerifiedTutor(db: AdminDb, userId: string): Promise<TutorDbRow> {
  const tutor = await getMyTutorRow(db, userId);
  if (!tutor) fail("connections.error.not_a_tutor");
  if (!isVerifiedTutor(tutor)) fail("connections.error.forbidden");
  return tutor;
}

function tutorToPublic(row: TutorDbRow): ConnectionTutorPublic {
  return {
    id: row.id,
    display_name: row.display_name,
    photo_url: row.photo_url,
    tutor_code: row.tutor_code,
    subjects: Array.isArray(row.subjects)
      ? row.subjects.filter((s): s is string => typeof s === "string")
      : [],
    district: row.district,
    verification_tier: row.verification_tier,
    is_published: row.is_published,
    curricula: extractCurricula(row.pricing_tiers),
  };
}

/**
 * Best-effort bus event insert (same contract as the lesson lifecycle
 * events): a failed insert must never fail the connection action, and the
 * (event_type, source_id) dedupe key + unique index absorb replays.
 */
async function insertConnectionEvent(
  db: AdminDb,
  eventType: "connect.request" | "connect.accepted",
  payload: Record<string, unknown>,
  connectionId: string,
): Promise<void> {
  try {
    const { error } = await db
      .from<Row>("case_events")
      .insert({ event_type: eventType, payload, source_id: connectionId })
      .select("id")
      .single();
    if (error && !/duplicate|unique/i.test(error?.message ?? "")) {
      console.warn(`[connections] event ${eventType} not recorded: ${error.message}`);
    }
  } catch (e) {
    console.warn(
      `[connections] event ${eventType} not recorded:`,
      e instanceof Error ? e.message : e,
    );
  }
}

async function fetchPublicTutors(
  db: AdminDb,
  ids: string[],
): Promise<Map<string, ConnectionTutorPublic>> {
  const map = new Map<string, ConnectionTutorPublic>();
  if (ids.length === 0) return map;
  const { data } = await db.from<TutorDbRow>("tutors").select(TUTOR_PUBLIC_COLS).in("id", ids);
  for (const row of data ?? []) map.set(row.id, tutorToPublic(row));
  return map;
}

async function fetchPairEdge(db: AdminDb, me: string, other: string): Promise<ExistingEdge | null> {
  const { data } = await db
    .from<Row>("tutor_connections")
    .select("id, status, requester_tutor_id, cooldown_until")
    .or(tutorPairFilter(me, other))
    .limit(1);
  const row = (data ?? [])[0];
  if (!row) return null;
  const status = String(row.status);
  if (!(CONNECTION_STATUSES as readonly string[]).includes(status)) return null;
  return {
    id: String(row.id),
    status: status as ConnectionStatus,
    requester_tutor_id: String(row.requester_tutor_id),
    cooldown_until: typeof row.cooldown_until === "string" ? row.cooldown_until : null,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const listMyConnections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      verified: boolean;
      me: { id: string; display_name: string; tutor_code: string } | null;
      items: ConnectionItem[];
    }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = asAdminDb(supabaseAdmin);
      const tutor = await getMyTutorRow(db, context.userId);
      const me = tutor
        ? { id: tutor.id, display_name: tutor.display_name, tutor_code: tutor.tutor_code }
        : null;
      if (!tutor || !isVerifiedTutor(tutor)) {
        // Unverified/non-tutor accounts get the gate state, never rows.
        return { verified: false, me, items: [] };
      }

      const { data } = await db
        .from<Row>("tutor_connections")
        .select(
          "id, requester_tutor_id, recipient_tutor_id, status, intent_tag, intro_note_sanitized, cooldown_until, created_at, responded_at",
        )
        .or(`requester_tutor_id.eq.${tutor.id},recipient_tutor_id.eq.${tutor.id}`)
        .order("created_at", { ascending: false })
        .limit(200);

      const rows = data ?? [];
      const otherIds = [
        ...new Set(
          rows.map((r) =>
            r.requester_tutor_id === tutor.id
              ? String(r.recipient_tutor_id)
              : String(r.requester_tutor_id),
          ),
        ),
      ];
      const tutorsById = await fetchPublicTutors(db, otherIds);

      const items: ConnectionItem[] = [];
      for (const r of rows) {
        const outbound = r.requester_tutor_id === tutor.id;
        const counterpartId = outbound
          ? String(r.recipient_tutor_id)
          : String(r.requester_tutor_id);
        const counterpart = tutorsById.get(counterpartId);
        if (!counterpart) continue;
        const status = String(r.status);
        if (!(CONNECTION_STATUSES as readonly string[]).includes(status)) continue;
        const intentTag = String(r.intent_tag);
        if (!isConnectIntentTag(intentTag)) continue;
        items.push({
          id: String(r.id),
          status: status as ConnectionStatus,
          direction: outbound ? "outbound" : "inbound",
          counterpart,
          intentTag,
          introNote: typeof r.intro_note_sanitized === "string" ? r.intro_note_sanitized : null,
          cooldownUntil: typeof r.cooldown_until === "string" ? r.cooldown_until : null,
          createdAt: String(r.created_at ?? ""),
          respondedAt: typeof r.responded_at === "string" ? r.responded_at : null,
        });
      }
      return { verified: true, me, items };
    },
  );

export const listConnectableTutors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        subject: z.string().trim().max(80).optional(),
        curriculum: z.string().trim().max(40).optional(),
        district: z.string().trim().max(60).optional(),
        intentTag: z.string().trim().max(30).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(
    async ({ context, data }): Promise<{ verified: boolean; tutors: ConnectionFindTutor[] }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = asAdminDb(supabaseAdmin);
      const me = await requireVerifiedTutor(db, context.userId);

      // ACTIVE_VERIFIED + live card only, never me, bounded pool.
      const { data: rows } = await db
        .from<TutorDbRow>("tutors")
        .select(TUTOR_PUBLIC_COLS)
        .eq("verification_tier", "tier_2_verified")
        .eq("is_published", true)
        .neq("id", me.id)
        .order("created_at", { ascending: false })
        .limit(60);

      const subject = data.subject?.trim() ?? "";
      const curriculum = data.curriculum?.trim() ?? "";
      const district = data.district?.trim() ?? "";
      const intentTag = data.intentTag?.trim() ?? "";

      const filtered = (rows ?? []).filter((row) => {
        const subjects = Array.isArray(row.subjects)
          ? row.subjects.filter((s): s is string => typeof s === "string")
          : [];
        if (subject && !subjects.some((s) => matchesSubjectQuery(s, subject))) return false;
        if (curriculum && !matchesCategoryFilter(curriculum, subjects)) return false;
        if (district && row.district !== district) return false;
        return true;
      });

      // #617 intent filter: no tutor-side intent field exists (V1), so an
      // intent tag narrows to tutors with demonstrated history — at least one
      // ACCEPTED edge carrying that intent_tag anywhere in the graph.
      let intentTutorIds: Set<string> | null = null;
      if (isConnectIntentTag(intentTag)) {
        intentTutorIds = new Set();
        const { data: edges } = await db
          .from<Row>("tutor_connections")
          .select("requester_tutor_id, recipient_tutor_id, intent_tag, status")
          .eq("intent_tag", intentTag)
          .eq("status", "ACCEPTED")
          .limit(500);
        for (const edge of edges ?? []) {
          intentTutorIds.add(String(edge.requester_tutor_id));
          intentTutorIds.add(String(edge.recipient_tutor_id));
        }
      }

      const { data: myEdges } = await db
        .from<Row>("tutor_connections")
        .select("requester_tutor_id, recipient_tutor_id, status")
        .or(`requester_tutor_id.eq.${me.id},recipient_tutor_id.eq.${me.id}`)
        .limit(200);
      const statusByOtherId = new Map<
        string,
        { status: string; direction: "outbound" | "inbound" }
      >();
      for (const edge of myEdges ?? []) {
        const outbound = edge.requester_tutor_id === me.id;
        const otherId = outbound
          ? String(edge.recipient_tutor_id)
          : String(edge.requester_tutor_id);
        if (!statusByOtherId.has(otherId)) {
          statusByOtherId.set(otherId, {
            status: String(edge.status),
            direction: outbound ? "outbound" : "inbound",
          });
        }
      }

      const tutors: ConnectionFindTutor[] = [];
      for (const row of filtered) {
        if (intentTutorIds && !intentTutorIds.has(row.id)) continue;
        const edge = statusByOtherId.get(row.id);
        const status = edge?.status ?? "none";
        tutors.push({
          ...tutorToPublic(row),
          viewerStatus:
            status === "none" || (CONNECTION_STATUSES as readonly string[]).includes(status)
              ? (status as ConnectionFindTutor["viewerStatus"])
              : "none",
          viewerDirection: edge?.direction ?? null,
        });
      }
      return { verified: true, tutors };
    },
  );

export const getConnectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ tutorId: z.string().uuid() }).parse(input))
  .handler(
    async ({
      context,
      data,
    }): Promise<{
      verified: boolean;
      self: boolean;
      targetVerified: boolean;
      status: "none" | ConnectionStatus;
      direction: "outbound" | "inbound" | null;
      cooldownUntil: string | null;
    }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = asAdminDb(supabaseAdmin);
      const me = await requireVerifiedTutor(db, context.userId);
      if (data.tutorId === me.id) {
        return {
          verified: true,
          self: true,
          targetVerified: false,
          status: "none",
          direction: null,
          cooldownUntil: null,
        };
      }
      const targets = await fetchPublicTutors(db, [data.tutorId]);
      const target = targets.get(data.tutorId);
      const targetVerified = target?.verification_tier === "tier_2_verified";
      const edge = await fetchPairEdge(db, me.id, data.tutorId);
      return {
        verified: true,
        self: false,
        targetVerified,
        status:
          edge && (CONNECTION_STATUSES as readonly string[]).includes(edge.status)
            ? (edge.status as ConnectionStatus)
            : "none",
        direction: edge ? (edge.requester_tutor_id === me.id ? "outbound" : "inbound") : null,
        cooldownUntil: edge?.cooldown_until ?? null,
      };
    },
  );

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const sendConnectionRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        recipientTutorId: z.string().uuid(),
        intentTag: z.string().refine(isConnectIntentTag, "invalid intent tag"),
        introNote: z.string().max(10000).optional(),
      })
      .parse(input),
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<{
      ok: boolean;
      status: ConnectionStatus;
      mutual: boolean;
      alreadyRequested: boolean;
    }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = asAdminDb(supabaseAdmin);
      const now = new Date();
      const me = await requireVerifiedTutor(db, context.userId);
      if (data.recipientTutorId === me.id) fail("connections.error.self");

      const recipients = await fetchPublicTutors(db, [data.recipientTutorId]);
      const target = recipients.get(data.recipientTutorId);
      if (!target) fail("connections.error.not_found");
      if (!isVerifiedTutor(target)) fail("connections.error.forbidden");

      // Optional note: 140-char cap enforced by the sanitizer (null = reject).
      let note: string | null = null;
      if (data.introNote && data.introNote.trim()) {
        note = sanitizeIntroNote(data.introNote);
        if (note === null) fail("connections.error.note_too_long");
      }

      // Rate caps: 10 outbound / 24h, 25 open PENDING outbound.
      const cutoffIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const recent = await db
        .from<{ created_at: string }>("tutor_connections")
        .select("created_at")
        .eq("requester_tutor_id", me.id)
        .gte("created_at", cutoffIso)
        .limit(50);
      const openPending = await db
        .from<{ id: string }>("tutor_connections")
        .select("id")
        .eq("requester_tutor_id", me.id)
        .eq("status", "PENDING")
        .limit(30);
      const verdict = gateOutbound(
        countOutboundRequests24h(
          (recent.data ?? []).map((r) => r.created_at),
          now,
        ),
        (openPending.data ?? []).length,
      );
      if (verdict === "daily_cap") fail("connections.error.daily_cap");
      if (verdict === "pending_cap") fail("connections.error.pending_cap");

      const intentTag = data.intentTag as ConnectIntentTag;
      const existing = await fetchPairEdge(db, me.id, data.recipientTutorId);
      const decision = decideRequest(existing, me.id, now);

      if (decision.action === "reject") {
        if (decision.reason === "already_pending") {
          // Idempotent re-send: the first request still stands.
          return { ok: true, status: "PENDING", mutual: false, alreadyRequested: true };
        }
        if (decision.reason === "cooldown") fail("connections.error.cooldown");
        fail("connections.error.already_connected");
      }

      if (decision.action === "accept_mutual") {
        // Mutual simultaneous requests meet on the existing edge (unique pair
        // index); the first mover's intent/note stay canonical.
        const { error } = await db
          .from<Row>("tutor_connections")
          .update({
            status: "ACCEPTED",
            responded_at: now.toISOString(),
            updated_at: now.toISOString(),
            cooldown_until: null,
          })
          .eq("id", decision.edgeId)
          .eq("status", "PENDING");
        if (error) fail("connections.error.save_failed");
        await insertConnectionEvent(
          db,
          "connect.accepted",
          {
            tutor_id:
              existing && existing.requester_tutor_id !== me.id
                ? existing.requester_tutor_id
                : data.recipientTutorId,
            requester_name: me.display_name,
            requester_code: me.tutor_code,
            connection_id: decision.edgeId,
          },
          decision.edgeId,
        );
        return { ok: true, status: "ACCEPTED", mutual: true, alreadyRequested: false };
      }

      if (decision.action === "reopen" && existing) {
        const { error } = await db
          .from<Row>("tutor_connections")
          .update({
            status: "PENDING",
            requester_tutor_id: me.id,
            recipient_tutor_id: data.recipientTutorId,
            intent_tag: intentTag,
            intro_note_sanitized: note,
            cooldown_until: null,
            created_at: now.toISOString(),
            responded_at: null,
            updated_at: now.toISOString(),
          })
          .eq("id", decision.edgeId)
          .in("status", ["DECLINED", "DISCONNECTED"]);
        if (error) fail("connections.error.save_failed");
        await insertConnectionEvent(
          db,
          "connect.request",
          {
            tutor_id: data.recipientTutorId,
            requester_tutor_id: me.id,
            requester_name: me.display_name,
            requester_code: me.tutor_code,
            intent_tag: intentTag,
            connection_id: decision.edgeId,
          },
          decision.edgeId,
        );
        return { ok: true, status: "PENDING", mutual: false, alreadyRequested: false };
      }

      // insert. A 23505 unique-pair race (two simultaneous requests) falls
      // back to the mutual-accept path on the winning row.
      const inserted = await db
        .from<Row>("tutor_connections")
        .insert({
          requester_tutor_id: me.id,
          recipient_tutor_id: data.recipientTutorId,
          status: "PENDING",
          intent_tag: intentTag,
          intro_note_sanitized: note,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select("id")
        .single();
      if (inserted.error) {
        if (
          /duplicate|unique/i.test(inserted.error.message ?? "") ||
          inserted.error.code === "23505"
        ) {
          const raced = await fetchPairEdge(db, me.id, data.recipientTutorId);
          if (raced && raced.status === "PENDING" && raced.requester_tutor_id !== me.id) {
            const { error } = await db
              .from<Row>("tutor_connections")
              .update({
                status: "ACCEPTED",
                responded_at: now.toISOString(),
                updated_at: now.toISOString(),
                cooldown_until: null,
              })
              .eq("id", raced.id)
              .eq("status", "PENDING");
            if (!error) {
              await insertConnectionEvent(
                db,
                "connect.accepted",
                {
                  tutor_id: raced.requester_tutor_id,
                  requester_name: me.display_name,
                  requester_code: me.tutor_code,
                  connection_id: raced.id,
                },
                raced.id,
              );
              return { ok: true, status: "ACCEPTED", mutual: true, alreadyRequested: false };
            }
          }
          return { ok: true, status: "PENDING", mutual: false, alreadyRequested: true };
        }
        fail("connections.error.save_failed");
      }
      const edgeId = String((inserted.data as Row | null)?.id ?? "");
      await insertConnectionEvent(
        db,
        "connect.request",
        {
          tutor_id: data.recipientTutorId,
          requester_tutor_id: me.id,
          requester_name: me.display_name,
          requester_code: me.tutor_code,
          intent_tag: intentTag,
          connection_id: edgeId,
        },
        edgeId,
      );
      return { ok: true, status: "PENDING", mutual: false, alreadyRequested: false };
    },
  );

export const respondToConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        connectionId: z.string().uuid(),
        action: z.enum(["accept", "decline"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean; status: ConnectionStatus }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const now = new Date();
    const me = await requireVerifiedTutor(db, context.userId);

    const { data: rows } = await db
      .from<Row>("tutor_connections")
      .select("id, requester_tutor_id, recipient_tutor_id, status")
      .eq("id", data.connectionId)
      .limit(1);
    const row = (rows ?? [])[0];
    if (!row) fail("connections.error.not_found");
    // Only the RECIPIENT of a PENDING request may respond.
    if (row.recipient_tutor_id !== me.id || row.status !== "PENDING") {
      fail("connections.error.forbidden");
    }

    if (data.action === "accept") {
      const { error } = await db
        .from<Row>("tutor_connections")
        .update({
          status: "ACCEPTED",
          responded_at: now.toISOString(),
          updated_at: now.toISOString(),
          cooldown_until: null,
        })
        .eq("id", data.connectionId)
        .eq("status", "PENDING");
      if (error) fail("connections.error.save_failed");
      await insertConnectionEvent(
        db,
        "connect.accepted",
        {
          // The bell reaches the original requester's account.
          tutor_id: String(row.requester_tutor_id),
          requester_name: me.display_name,
          requester_code: me.tutor_code,
          connection_id: data.connectionId,
        },
        data.connectionId,
      );
      return { ok: true, status: "ACCEPTED" };
    }

    // Decline: 30-day pair cooldown (#617). No bell — a decline stays quiet.
    const { error } = await db
      .from<Row>("tutor_connections")
      .update({
        status: "DECLINED",
        responded_at: now.toISOString(),
        updated_at: now.toISOString(),
        cooldown_until: declineCooldownUntil(now),
      })
      .eq("id", data.connectionId)
      .eq("status", "PENDING");
    if (error) fail("connections.error.save_failed");
    return { ok: true, status: "DECLINED" };
  });

export const disconnectConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ connectionId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: boolean; status: ConnectionStatus }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const me = await requireVerifiedTutor(db, context.userId);
    const nowIso = new Date().toISOString();

    const { data: rows } = await db
      .from<Row>("tutor_connections")
      .select("id, requester_tutor_id, recipient_tutor_id, status")
      .eq("id", data.connectionId)
      .limit(1);
    const row = (rows ?? [])[0];
    if (!row) fail("connections.error.not_found");
    // Either party may disconnect an ACCEPTED edge.
    if (
      row.status !== "ACCEPTED" ||
      (row.requester_tutor_id !== me.id && row.recipient_tutor_id !== me.id)
    ) {
      fail("connections.error.forbidden");
    }
    const { error } = await db
      .from<Row>("tutor_connections")
      .update({ status: "DISCONNECTED", updated_at: nowIso, responded_at: nowIso })
      .eq("id", data.connectionId)
      .eq("status", "ACCEPTED");
    if (error) fail("connections.error.save_failed");
    return { ok: true, status: "DISCONNECTED" };
  });
