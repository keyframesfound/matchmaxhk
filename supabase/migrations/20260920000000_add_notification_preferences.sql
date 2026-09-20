-- Settings-page notification preferences: stored on the profile so the
-- upcoming transactional email flows (case updates, match suggestions,
-- tutor leads, product news) can honour each user's choices. JSONB so new
-- preference keys can ship without further migrations. RLS is unchanged —
-- profiles already allows own-row updates.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL
  DEFAULT '{"case_updates": true, "match_suggestions": true, "tutor_leads": true, "product_news": false}';
