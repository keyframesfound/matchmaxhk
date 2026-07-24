import * as React from 'react'
import { render } from '@react-email/render'
import { Resend } from 'resend'
import { TEMPLATES } from './registry'

// Server-only: reads RESEND_API_KEY. Never import from client components.

// Configuration baked in at scaffold time
const SITE_NAME = "matchmaxhk"
// FROM_DOMAIN is the domain shown in the From: header. Must be a domain you've
// verified in your Resend account (Resend -> Domains).
const FROM_DOMAIN = "maxmatch.app"

const resend = new Resend(process.env.RESEND_API_KEY)

export type SendTemplateEmailResult =
  | { sent: true }
  | { sent: false; reason: 'recipient_suppressed' }

export interface SendTemplateEmailOptions {
  templateData?: Record<string, any>
  /** Dedupes retries of the same logical send; defaults to a random UUID (no dedupe). */
  idempotencyKey?: string
  replyTo?: string
}

/**
 * Renders a registered template and sends it through Resend.
 *
 * NOTE on behavior change: Lovable's email-js enforced suppression/retry/rate-limit
 * rules server-side and returned { sent: false, reason: 'recipient_suppressed' } for
 * suppressed recipients instead of throwing. Resend has its own suppression list
 * product (Resend -> Suppressions) but surfaces it differently (via a `x-resend-*`
 * error code, not a stable `.reason` field on success). Until you've confirmed the
 * exact shape Resend returns for your account, this version treats every send error
 * as a thrown exception — adjust the catch block below if you need the same
 * "suppressed recipient" branch as before.
 */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {}
): Promise<SendTemplateEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const template = TEMPLATES[templateName]
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`
    )
  }

  // Template-level `to` takes precedence — notification templates always
  // send to their fixed address.
  const recipient = template.to || to
  if (!recipient) {
    throw new Error('Recipient is required (the template defines no fixed recipient)')
  }

  const templateData = options.templateData ?? {}
  const element = React.createElement(template.component, templateData)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  const { error } = await resend.emails.send({
    from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
    to: recipient,
    subject,
    html,
    text,
    reply_to: options.replyTo,
    headers: options.idempotencyKey
      ? { 'Idempotency-Key': options.idempotencyKey }
      : undefined,
  })

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`)
  }

  return { sent: true }
}
