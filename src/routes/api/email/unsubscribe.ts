import { createFileRoute } from "@tanstack/react-router";

import { verifyUnsubscribeToken } from "@/lib/email-templates/email-policy";

/**
 * #783 §2.3: one-click unsubscribe from MatchMax marketing email.
 * - POST (RFC 8058 List-Unsubscribe-Post from the mail app, or the button
 *   below): turns marketing_email_opt_in off for the signed account.
 * - GET (the footer link): a tiny bilingual page with one button, so link
 *   scanners that prefetch URLs never unsubscribe anyone by accident.
 * Transactional mail (receipts, attendance, trial updates) is unaffected.
 */

function secret(): string | null {
  return process.env.EMAIL_UNSUBSCRIBE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

function page(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>MatchMax email preferences</title><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#0f172a;line-height:1.6}button{background:#0f172a;color:#fff;border:0;border-radius:999px;padding:.75rem 1.5rem;font-weight:700;font-size:1rem;cursor:pointer}a{color:#1d9bf0}</style></head><body>${body}</body></html>`,
    {
      status,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    },
  );
}

const escapeAttr = (value: string) => value.replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);

async function unsubscribe(token: string): Promise<boolean> {
  const key = secret();
  if (!key) return false;
  const userId = await verifyUnsubscribeToken(token, key);
  if (!userId) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ marketing_email_opt_in: false } as never)
    .eq("id", userId);
  return !error;
}

export const Route = createFileRoute("/api/email/unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") ?? "";
        if (!token) return page("<p>Invalid link. 連結無效。</p>", 400);
        return page(
          `<h1>Unsubscribe from MatchMax marketing email?<br>取消訂閱 MatchMax 推廣電郵？</h1><p>You will still get important account, lesson and payment emails.<br>你仍會收到帳戶、課堂及付款相關的重要電郵。</p><form method="post"><input type="hidden" name="token" value="${escapeAttr(token)}"><button type="submit">Unsubscribe · 取消訂閱</button></form>`,
        );
      },
      POST: async ({ request }) => {
        const url = new URL(request.url);
        let token = url.searchParams.get("token") ?? "";
        if (!token) {
          const form = await request.formData().catch(() => null);
          const value = form?.get("token");
          token = typeof value === "string" ? value : "";
        }
        const ok = token ? await unsubscribe(token) : false;
        return ok
          ? page(
              `<h1>You're unsubscribed. 已取消訂閱。</h1><p>Change this any time in <a href="/dashboard#notifications">Settings → Notifications</a>.<br>可隨時在「設定 → 通知」更改。</p>`,
            )
          : page("<p>This link is invalid or expired. 連結無效或已過期。</p>", 400);
      },
    },
  },
});
