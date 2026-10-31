/**
 * Issue #459 slice 6 — child claim flow (§15.3, email channel only; the
 * WhatsApp channel stays out per the owner's instruction).
 *
 * The parent invites a managed child to take over their sub-profile: a
 * one-time 7-day token is stored as a SHA-256 hash (the raw value only ever
 * travels in the email link and is never logged), and the child accepts at
 * /account/claim-child. Accepting sets students.owner_user_id and flips the
 * sub-profile to claimed_independent; the parent link stays for view/billing.
 *
 * child_claim_tokens and students are service-role only, so every read and
 * write is scoped in-handler (the same pattern as children.functions.ts).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const CLAIM_TOKEN_DAYS = 7;

const EMAIL_MAX = 254;

type TokenRow = {
  id: string;
  student_id: string;
  parent_user_id: string;
  token_hash: string;
  delivery_target: string;
  expires_at: string;
  used_at: string | null;
  used_by_user_id: string | null;
  revoked_at: string | null;
};

async function claimDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export type ChildClaimState = "valid" | "expired" | "used" | "revoked" | "not_found";

function stateOf(
  row: Pick<TokenRow, "expires_at" | "used_at" | "revoked_at">,
  now: Date,
): ChildClaimState {
  if (row.used_at) return "used";
  if (row.revoked_at) return "revoked";
  if (new Date(row.expires_at).getTime() <= now.getTime()) return "expired";
  return "valid";
}

async function requireClaimableChild(db: Db, userId: string, studentId: string) {
  const rows = await selectRows<{
    id: string;
    nickname: string;
    status: string;
    archived_at: string | null;
    owner_user_id: string | null;
  }>(db, "students", "id, nickname, status, archived_at, owner_user_id", [
    { col: "id", op: "eq", value: studentId },
    { col: "parent_user_id", op: "eq", value: userId },
  ]);
  const child = rows[0];
  if (!child || child.archived_at) throw new Error("CLAIM_CHILD_NOT_FOUND");
  if (child.status !== "managed_by_parent" || child.owner_user_id) {
    throw new Error("CLAIM_CHILD_NOT_MANAGED");
  }
  return child;
}

// ---------------------------------------------------------------------------
// Parent: send the claim invite
// ---------------------------------------------------------------------------

export const startChildClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) =>
    z
      .object({
        studentId: z.string().uuid(),
        email: z.string().trim().email().max(EMAIL_MAX),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true; delivered: boolean }> => {
    const db = await claimDb();
    await requireClaimableChild(db, context.userId, data.studentId);
    const email = data.email.toLowerCase();

    // §15.3: a new invite invalidates any prior unused tokens for the child.
    const now = new Date().toISOString();
    const { error: revokeError } = await db
      .from("child_claim_tokens")
      .update({ revoked_at: now })
      .eq("student_id", data.studentId)
      .eq("parent_user_id", context.userId)
      .eq("used_at", null)
      .eq("revoked_at", null);
    if (revokeError) throw new Error(revokeError.message);

    const raw = generateRawToken();
    const expiresAt = new Date(Date.now() + CLAIM_TOKEN_DAYS * 24 * 3_600_000).toISOString();
    const { error } = await db.from("child_claim_tokens").insert({
      student_id: data.studentId,
      parent_user_id: context.userId,
      token_hash: hashToken(raw),
      delivery_channel: "email",
      delivery_target: email,
      expires_at: expiresAt,
    });
    if (error) throw new Error(error.message);

    // Degrade gracefully: a Resend outage must not fail the request — the
    // token stays valid so the parent can resend (a resend revokes this one
    // and issues a fresh link).
    const apiKey = getRuntimeEnv("RESEND_API_KEY");
    if (!apiKey) {
      console.error("[child-claim] RESEND_API_KEY missing; claim email skipped");
      return { ok: true, delivered: false };
    }
    const { Resend } = await import("resend");
    const link = `https://matchmax.hk/account/claim-child?token=${raw}`;
    const { error: sendError } = await new Resend(apiKey).emails.send({
      from: "MatchMax <noreply@matchmax.hk>",
      to: email,
      subject: "Claim your MatchMax learner profile",
      text: [
        "Hi,",
        "",
        "Your parent/guardian has invited you to take over your MatchMax learner profile.",
        "Open the link below within 7 days to claim it:",
        "",
        link,
        "",
        "The link works once, for the account you sign in with. If you were not expecting this email you can ignore it.",
        "",
        "MatchMax",
      ].join("\n"),
      html: [
        "<p>Hi,</p>",
        "<p>Your parent/guardian has invited you to take over your MatchMax learner profile.</p>",
        `<p><a href="${link}">Claim your learner profile</a> (valid for 7 days, one use)</p>`,
        "<p>The link works once, for the account you sign in with. If you were not expecting this email you can ignore it.</p>",
        "<p>MatchMax</p>",
      ].join(""),
    });
    if (sendError) {
      console.error("[child-claim] claim email send failed:", sendError.message);
      return { ok: true, delivered: false };
    }
    return { ok: true, delivered: true };
  });

// ---------------------------------------------------------------------------
// Child: preview + accept
// ---------------------------------------------------------------------------

export type ChildClaimPreview = {
  state: ChildClaimState;
  nickname: string | null;
  verifiedHours: number | null;
};

export const getChildClaimPreview = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10).max(200) }).parse(input))
  .handler(async ({ data }): Promise<ChildClaimPreview> => {
    const db = await claimDb();
    const rows = await selectRows<TokenRow>(
      db,
      "child_claim_tokens",
      "id, student_id, parent_user_id, token_hash, delivery_target, expires_at, used_at, used_by_user_id, revoked_at",
      [{ col: "token_hash", op: "eq", value: hashToken(data.token) }],
    );
    const token = rows[0];
    if (!token) return { state: "not_found", nickname: null, verifiedHours: null };

    const state = stateOf(token, new Date());
    const students = await selectRows<{ nickname: string }>(db, "students", "nickname", [
      { col: "id", op: "eq", value: token.student_id },
    ]);
    const hours = await db
      .from<{ duration_hours: number | string; status: string }>("verified_hours_ledger")
      .select("duration_hours, status")
      .eq("student_id", token.student_id);
    const verified = (hours.data ?? [])
      .filter((row) => row.status === "verified_completed")
      .reduce((sum, row) => sum + Number(row.duration_hours), 0);

    return {
      state,
      nickname: students[0]?.nickname ?? null,
      verifiedHours: Math.round(verified * 100) / 100,
    };
  });

export const acceptChildClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10).max(200) }).parse(input))
  .handler(async ({ context, data }): Promise<{ nickname: string }> => {
    const db = await claimDb();
    const rows = await selectRows<TokenRow>(
      db,
      "child_claim_tokens",
      "id, student_id, parent_user_id, token_hash, delivery_target, expires_at, used_at, used_by_user_id, revoked_at",
      [{ col: "token_hash", op: "eq", value: hashToken(data.token) }],
    );
    const token = rows[0];
    if (!token) throw new Error("CLAIM_INVALID");
    const state = stateOf(token, new Date());
    if (state !== "valid") throw new Error(`CLAIM_${state.toUpperCase()}`);
    // §15.3 edge: the signed-in account must not be the parent themself.
    if (context.userId === token.parent_user_id) throw new Error("CLAIM_SELF_PARENT");

    const students = await selectRows<{ nickname: string; owner_user_id: string | null }>(
      db,
      "students",
      "nickname, owner_user_id",
      [{ col: "id", op: "eq", value: token.student_id }],
    );
    const child = students[0];
    if (!child) throw new Error("CLAIM_INVALID");
    if (child.owner_user_id) throw new Error("CLAIM_USED");

    const now = new Date().toISOString();
    // Consume the token first: the one-time semantics ride on used_at/
    // revoked_at IS NULL, so two simultaneous accepts cannot both proceed
    // (the #387 predicate+rowCount race guard; expiry is already gated by
    // stateOf above — an expired token is a UI state, not a security bound).
    const { count: consumed, error: consumeError } = await db
      .from("child_claim_tokens")
      .update({ used_at: now, used_by_user_id: context.userId }, { count: "exact" })
      .eq("id", token.id)
      .eq("used_at", null)
      .eq("revoked_at", null);
    if (consumeError) throw new Error(consumeError.message);
    if (!consumed) throw new Error("CLAIM_INVALID");

    const { error: claimError } = await db
      .from("students")
      .update({
        owner_user_id: context.userId,
        status: "claimed_independent",
        updated_at: now,
      })
      .eq("id", token.student_id)
      .eq("owner_user_id", null);
    if (claimError) throw new Error(claimError.message);

    return { nickname: child.nickname };
  });
