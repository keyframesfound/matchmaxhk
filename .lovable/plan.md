## 1. Admin-controlled landing hero tutor

**Data**
- Add a new `app_settings` row: `hero_tutor_code` (string, the tutor's code to feature). Extend the public whitelist policy to expose this key.

**Admin UI** — `src/routes/_authenticated.admin.settings.tsx`
- Add a "Landing hero tutor" searchable dropdown (using existing `SearchableSelect`) populated from all published tutors (`display_name — tutor_code`). Saves the selected `tutor_code` into `hero_tutor_code`.

**Landing hero** — `src/routes/index.tsx`
- Fetch `hero_tutor_code` from `app_settings` and load that tutor via `fetchTutorByCode`. Fallback to the top weekly tutor when unset or not found.
- Replace the hardcoded "Dr. Michelle Ho / DSE Mathematics · M2 / 98% / $650 / 4.9★" card with real fields: photo (or brand gradient placeholder), `display_name`, `headline` or top subjects, hourly rate, and rating. The card links to `/tutors/{tutor_code}`.

## 2. Admin-controlled subject list (Browse Tutors filter)

**Data**
- Add `app_settings` row `subject_options` (JSON array of strings, e.g. `["Mathematics","English",...]`). Add to the public whitelist policy so anonymous visitors can read it.
- Seed with the full canonical subject list already used inside the admin tutor form (`ALL_SUBJECTS`).

**Admin UI** — `src/routes/_authenticated.admin.settings.tsx`
- New "Browse-page subjects" section: multi-select chips + free-text add, seeded with the current default list, saved back to `subject_options`.

**Browse page** — `src/routes/tutors.index.tsx`
- Replace the hardcoded 9-item list in the "Any subject" dropdown with a `useQuery` on `subject_options`. If the setting is empty, fall back to the canonical `ALL_SUBJECTS` list from the tutor form so the dropdown always matches what admins can actually assign to tutors (no more mismatch between browse filter and tutor profile).

## Scope guardrails
- No changes to tutor schema, review flow, or WhatsApp behavior.
- Existing tutor cards on the landing page (Featured Tutors section) remain unchanged; only the top hero-visual card and the browse-page subject filter are affected.
