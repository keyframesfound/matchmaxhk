-- #553 global search: admin tag moderation (CEO lock 2026-11-01).
-- Free-form tags stay on their content rows (digital_materials.search_tags,
-- tutors.profile_tags, tutoring_cases.tags). This table only overrides how
-- a tag surfaces: hidden = never in typeahead / public chips; merged_into =
-- alias redirect to a canonical tag for search + typeahead. Historical
-- attachment rows are never rewritten (#415 portfolio-hide pattern).
-- Staff-only: RLS on, no client policies; server fns use service role.
-- Apply via Supabase MCP apply_migration.

CREATE TABLE IF NOT EXISTS public.search_tag_overrides (
  tag text PRIMARY KEY CHECK (char_length(tag) BETWEEN 2 AND 32),
  hidden boolean NOT NULL DEFAULT false,
  merged_into text CHECK (merged_into IS NULL OR char_length(merged_into) BETWEEN 2 AND 32),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (merged_into IS NULL OR merged_into <> tag)
);
ALTER TABLE public.search_tag_overrides ENABLE ROW LEVEL SECURITY;
