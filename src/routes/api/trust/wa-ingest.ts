import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { normalizePhone } from "@/features/cases/import-plan";
import { classifyWhatsAppMessage, verifyIngestSignature } from "@/features/trust/wa-classifier";

/**
 * Issue #529 §D — WhatsApp Business → advisory risk flags.
 *
 * The WA desk automation (#511) POSTs each chat line here, signed with
 * HMAC-SHA256 of the raw body under TRUST_WA_INGEST_SECRET in the
 * `x-matchmax-signature` header. Lines are classified (rules, advisory) and
 * each hit opens a case_risk_flags row (source ai_advisory, channel
 * whatsapp_webhook) on the matching live case — which revokes contact reveal
 * for blocking types — and pings ops. Bans / blacklists stay human-only.
 * The message body is never stored; only the matched keyword.
 */

const MAX_BODY_BYTES = 16_000;
const ENDED_STATUSES = new Set(["closed", "rejected"]);

const IngestSchema = z.object({
  text: z.string().min(1).max(4000),
  caseCode: z.string().trim().min(3).max(40).optional(),
  phone: z.string().trim().min(8).max(20).optional(),
});

/** The formats contact_phone is stored in for an 8-digit HK number. */
function phoneVariants(raw: string): string[] {
  const d = normalizePhone(raw);
  if (d.length !== 8) return [];
  return [d, `+852${d}`, `852${d}`, `+852 ${d}`, `${d.slice(0, 4)} ${d.slice(4)}`];
}

export const Route = createFileRoute("/api/trust/wa-ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.TRUST_WA_INGEST_SECRET;
        if (!secret) {
          return Response.json({ error: "Not configured" }, { status: 503 });
        }
        const raw = await request.text();
        if (raw.length > MAX_BODY_BYTES) {
          return Response.json({ error: "Payload too large" }, { status: 413 });
        }
        const ok = await verifyIngestSignature(
          raw,
          request.headers.get("x-matchmax-signature"),
          secret,
        );
        if (!ok) return Response.json({ error: "Invalid signature" }, { status: 401 });

        let parsed: z.infer<typeof IngestSchema>;
        try {
          parsed = IngestSchema.parse(JSON.parse(raw));
        } catch {
          return Response.json({ error: "Invalid payload" }, { status: 400 });
        }
        if (!parsed.caseCode && !parsed.phone) {
          return Response.json({ error: "caseCode or phone required" }, { status: 400 });
        }

        const hits = classifyWhatsAppMessage(parsed.text);
        if (hits.length === 0) return Response.json({ flagged: [] });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { asAdminDb } = await import("@/features/materials/storage-helpers");
          const { selectRows } = await import("@/features/cases/desk-db");
          const { insertOpenFlag } = await import("@/features/trust/trust.functions");
          const db = asAdminDb(supabaseAdmin);

          const variants = parsed.caseCode ? [] : phoneVariants(parsed.phone ?? "");
          if (!parsed.caseCode && variants.length === 0) {
            return Response.json({ flagged: [], unmatched: true });
          }
          const cases = await selectRows<{ id: string; status: string; created_at: string }>(
            db,
            "tutoring_cases",
            "id, status, created_at",
            parsed.caseCode
              ? [{ col: "case_code", op: "eq", value: parsed.caseCode.toUpperCase() }]
              : [{ col: "contact_phone", op: "in", value: variants }],
          );
          const live = cases
            .filter((c) => !ENDED_STATUSES.has(c.status))
            .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
          if (!live) return Response.json({ flagged: [], unmatched: true });

          const flagged: string[] = [];
          for (const hit of hits) {
            const isNew = await insertOpenFlag(db, {
              case_id: live.id,
              flag_type: hit.flagType,
              source: "ai_advisory",
              source_channel: "whatsapp_webhook",
              note: `WA keyword: ${hit.evidence}`,
              created_by: null,
            });
            if (isNew) flagged.push(hit.flagType);
          }
          if (flagged.length > 0) {
            const { notifyOps } = await import("@/lib/ops-webhook.server");
            void notifyOps("case.wa_risk_flag", { case_id: live.id, flags: flagged }).catch(
              () => {},
            );
          }
          return Response.json({ flagged });
        } catch (e) {
          console.error("[wa-ingest] failed:", e instanceof Error ? e.message : e);
          return Response.json({ error: "Ingest failed" }, { status: 500 });
        }
      },
    },
  },
});
