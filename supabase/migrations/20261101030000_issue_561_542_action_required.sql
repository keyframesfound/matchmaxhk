-- Issues #561 (Action Required notifications) + #542 (mode-aware triggers).
--
-- Extends the #205 notification bus (case_events + event_deliveries) rather
-- than adding a parallel stack:
--
--   * target_context          — 'learning' | 'teaching' | 'system' so the
--                               bell can filter by the active mode (#459
--                               Learning vs Teaching). Rows are tagged at
--                               delivery time and never re-tagged; switching
--                               mode only changes the filter, never deletes.
--   * action_required …       — the #561 Action Required surface: an open
--                               task with an urgency, a completion condition
--                               and a locked reminder schedule (max 3 sends:
--                               initial + follow-ups at High +1d/+3d,
--                               Medium +2d/+5d, Low +7d).
--
-- Posture unchanged: event_deliveries stays service-role only (RLS deny-all,
-- no policies — see 20261017150000_sor_case_core.sql). Every write goes
-- through the admin-db server fns.
--
-- Also: the `moderation` notification preference key (#542) — always on,
-- never a Settings toggle, so the DB default carries it for new rows. Reads
-- merge over DEFAULT_NOTIFICATION_PREFS which includes it, so existing rows
-- need no backfill.

ALTER TABLE public.event_deliveries
  ADD COLUMN IF NOT EXISTS target_context text
    CHECK (target_context IN ('learning', 'teaching', 'system')),
  ADD COLUMN IF NOT EXISTS action_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS action_type text,
  ADD COLUMN IF NOT EXISTS action_urgency text
    CHECK (action_urgency IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS action_status text
    CHECK (action_status IN ('open', 'resolved', 'dismissed')),
  ADD COLUMN IF NOT EXISTS action_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS action_dismissed_by uuid,
  ADD COLUMN IF NOT EXISTS action_reminder_count integer NOT NULL DEFAULT 0
    CHECK (action_reminder_count >= 0),
  ADD COLUMN IF NOT EXISTS action_next_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS action_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS action_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

-- #561 idempotence: at most one OPEN action per (type, entity, recipient).
-- Admin-appointed tasks pass a generated uuid as entity_id so the guard
-- covers them too. Resolved/dismissed rows fall out of the index, so a
-- scenario can legitimately re-fire after it was resolved once.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ar_open
  ON public.event_deliveries
    (action_type, recipient_account_id, COALESCE(action_meta ->> 'entity_id', ''))
  WHERE action_required AND action_status = 'open';

-- Reminder sweep: open actions due for their next follow-up.
CREATE INDEX IF NOT EXISTS idx_ar_due
  ON public.event_deliveries (action_next_reminder_at)
  WHERE action_required AND action_status = 'open';

COMMENT ON COLUMN public.event_deliveries.target_context IS
  '#542: mode tag for bell filtering — learning | teaching | system. Set at delivery time from the event/recipient; never rewritten on mode switch.';

COMMENT ON COLUMN public.event_deliveries.action_required IS
  '#561: this in-app delivery is an Action Required task (pinned bell item with completion tracking + reminder schedule).';

-- #542: `moderation` is a non-toggleable always-on preference. Existing rows
-- are handled in code (sanitizeNotificationPrefs merges the default).
ALTER TABLE public.profiles
  ALTER COLUMN notification_preferences
  SET DEFAULT '{"case_updates":true,"match_suggestions":true,"tutor_leads":true,"product_news":false,"moderation":true}'::jsonb;
