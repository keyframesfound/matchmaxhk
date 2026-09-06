import * as React from "react";
import { render } from "@react-email/render";
import { Webhook } from "standardwebhooks";
import { Resend } from "resend";
import { createFileRoute } from "@tanstack/react-router";
import { SignupEmail } from "@/lib/email-templates/signup";
import { InviteEmail } from "@/lib/email-templates/invite";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { EmailChangeEmail } from "@/lib/email-templates/email-change";
import { ReauthenticationEmail } from "@/lib/email-templates/reauthentication";

// Configuration
const SITE_NAME = "matchmaxhk";
const ROOT_DOMAIN = "matchmax.hk";
const FROM_DOMAIN = "matchmax.hk";
const SITE_URL = `https://${ROOT_DOMAIN}`;

// Lazy singleton — see send-email.ts for why this can't be constructed eagerly
// at module scope (it would crash every page, not just this webhook, if
// RESEND_API_KEY is ever unset).
let _resend: Resend | undefined;
function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

// Set in Supabase Dashboard -> Authentication -> Hooks -> Send Email Hook.
// The dashboard gives you a secret formatted "v1,whsec_<base64>" — strip the prefix,
// standardwebhooks wants the base64 part only.
const hookSecret = (process.env.SEND_EMAIL_HOOK_SECRET ?? "").replace("v1,whsec_", "");

type EmailActionType =
  "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "reauthentication";

interface SendEmailHookPayload {
  user: { email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
    // Present for email_change events. Field names per Supabase's Send Email Hook
    // payload — double-check these against a real payload (log it once, gated
    // behind a dev flag) before relying on this branch in production.
    email_new?: string;
  };
}

async function renderAuthEmail(
  payload: SendEmailHookPayload,
): Promise<{ subject: string; html: string }> {
  const { user, email_data } = payload;
  // Reconstructs the confirmation link Supabase's own hosted emails use.
  // See: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
  const confirmationUrl = `${process.env.SUPABASE_URL}/auth/v1/verify?token=${email_data.token_hash}&type=${email_data.email_action_type}&redirect_to=${email_data.redirect_to}`;

  switch (email_data.email_action_type) {
    case "signup":
      return {
        subject: "Confirm your email",
        html: await render(
          React.createElement(SignupEmail, {
            siteName: SITE_NAME,
            siteUrl: SITE_URL,
            recipient: user.email,
            confirmationUrl,
          }),
        ),
      };
    case "invite":
      return {
        subject: "You've been invited",
        html: await render(
          React.createElement(InviteEmail, {
            siteName: SITE_NAME,
            siteUrl: SITE_URL,
            confirmationUrl,
          }),
        ),
      };
    case "magiclink":
      return {
        subject: "Your login link",
        html: await render(
          React.createElement(MagicLinkEmail, {
            siteName: SITE_NAME,
            confirmationUrl,
          }),
        ),
      };
    case "recovery":
      return {
        subject: "Reset your password",
        html: await render(
          React.createElement(RecoveryEmail, {
            siteName: SITE_NAME,
            confirmationUrl,
          }),
        ),
      };
    case "email_change":
      return {
        subject: "Confirm your new email",
        html: await render(
          React.createElement(EmailChangeEmail, {
            siteName: SITE_NAME,
            oldEmail: user.email,
            email: user.email,
            newEmail: email_data.email_new ?? "",
            confirmationUrl,
          }),
        ),
      };
    case "reauthentication":
      return {
        subject: "Your verification code",
        html: await render(React.createElement(ReauthenticationEmail, { token: email_data.token })),
      };
    default:
      throw new Error(`Unhandled email action type: ${email_data.email_action_type}`);
  }
}

export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!hookSecret) {
          console.error("[auth-email-webhook] SEND_EMAIL_HOOK_SECRET is not configured");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        // Signature verification needs the raw request body, not parsed JSON.
        const rawBody = await request.text();
        const headers = Object.fromEntries(request.headers);
        const wh = new Webhook(hookSecret);

        let payload: SendEmailHookPayload;
        try {
          payload = wh.verify(rawBody, headers) as SendEmailHookPayload;
        } catch (err) {
          console.error("[auth-email-webhook] signature verification failed", err);
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }

        try {
          const { subject, html } = await renderAuthEmail(payload);
          const { error } = await getResend().emails.send({
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            to: [payload.user.email],
            subject,
            html,
          });
          if (error) {
            console.error("[auth-email-webhook] Resend send failed", error);
            return Response.json({ error: "Failed to send email" }, { status: 500 });
          }
        } catch (err) {
          console.error("[auth-email-webhook] failed to render/send", err);
          return Response.json({ error: "Failed to send email" }, { status: 500 });
        }

        // Supabase Auth expects a 200 with an empty (or {}) body on success.
        return Response.json({}, { status: 200 });
      },
    },
  },
});
