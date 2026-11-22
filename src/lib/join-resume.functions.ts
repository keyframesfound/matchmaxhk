/**
 * Issue #798 (AC-4, server half): guest join drafts for in-app browsers.
 *
 * A guest who opens /join inside WhatsApp / Instagram / Facebook / Threads /
 * Messenger / Line / WeChat cannot finish Google OAuth — Google refuses
 * embedded webviews with `disallowed_useragent` (see in-app-browser.ts). The
 * form saves the in-progress answers here, then offers a resume link that the
 * guest opens in Safari or Chrome, where OAuth works.
 *
 * Neither function requires auth: the guest has no session yet, which is the
 * whole problem. Abuse controls are the Turnstile check on save plus a hard
 * payload cap; the table is service-role only (RLS enabled, no policies, no
 * grants), and the raw token never comes back out of storage — the caller holds
 * it, we keep only the SHA-256 hash.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { selectRows, type Db } from "@/features/cases/desk-db";
import { asAdminDb } from "@/features/materials/storage-helpers";
import type { Json } from "@/integrations/supabase/types";

import { verifyTurnstile } from "@/lib/tutor-application.functions";
import { RESUME_TTL_MS, generateResumeToken, hashResumeToken } from "@/lib/resume-token";

const TABLE = "join_resume_drafts";

/**
 * 48k characters of JSON is far more than a full application (~4k) while
 * staying under the table's 64 KiB `payload` check constraint for ordinary
 * ASCII/JSON; the constraint remains the hard backstop.
 */
const PAYLOAD_MAX_LENGTH = 48_000;

type DraftRow = { payload: Json; expires_at: string };

async function resumeDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function payloadLength(payload: Record<string, unknown>): number {
  return JSON.stringify(payload).length;
}

// ---------------------------------------------------------------------------
// Save: guest starting the application inside an in-app browser
// ---------------------------------------------------------------------------

export const saveJoinResumeDraft = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ payload: z.unknown(), turnstileToken: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ token: string }> => {
    await verifyTurnstile(data.turnstileToken);

    if (!isPlainObject(data.payload) || payloadLength(data.payload) > PAYLOAD_MAX_LENGTH) {
      throw new Error("JOIN_RESUME_PAYLOAD_INVALID");
    }

    const db = await resumeDb();
    const raw = generateResumeToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESUME_TTL_MS).toISOString();

    const { error } = await db.from(TABLE).insert({
      token_hash: hashResumeToken(raw),
      payload: data.payload as Json,
      expires_at: expiresAt,
    });
    // A storage failure must not leak internals: the caller shows one generic
    // "couldn't save your progress" message.
    if (error) throw new Error(error.message);

    // Opportunistic sweep so the table does not grow forever; failure here is
    // cosmetic, never fatal (the expiry column alone already invalidates rows).
    const { error: sweepError } = await db
      .from(TABLE)
      .delete()
      .lte("expires_at", now.toISOString());
    if (sweepError) console.warn("[join-resume] expired draft sweep failed:", sweepError.message);

    return { token: raw };
  });

// ---------------------------------------------------------------------------
// Load: guest resuming in Safari / Chrome
// ---------------------------------------------------------------------------

export const loadJoinResumeDraft = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(20).max(200) }).parse(input))
  .handler(async ({ data }): Promise<{ payload: Json } | null> => {
    const db = await resumeDb();
    const nowIso = new Date().toISOString();
    // The token hash is the lookup key; the expiry predicate is re-checked in
    // JS so the boundary is strict (a row expiring exactly now is dead) and a
    // missing row stays a plain `null` rather than an error.
    const rows = await selectRows<DraftRow>(db, TABLE, "payload, expires_at", [
      { col: "token_hash", op: "eq", value: hashResumeToken(data.token) },
    ]);
    const row = rows[0];
    if (!row) return null;
    if (Date.parse(row.expires_at) <= Date.parse(nowIso)) return null;

    // Only the form payload ever leaves the server — never the hash, row id or
    // timestamps.
    return { payload: row.payload };
  });
