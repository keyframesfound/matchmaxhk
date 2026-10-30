-- Minimal stand-ins for the Supabase objects the #532/#534 migration
-- references, so it can run on plain Postgres (scripts/test-academy-sql.sh).
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.tutors (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.tutoring_cases (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.case_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid REFERENCES public.tutors(id),
  starts_at timestamptz NOT NULL,
  duration_min integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'planned'
);
