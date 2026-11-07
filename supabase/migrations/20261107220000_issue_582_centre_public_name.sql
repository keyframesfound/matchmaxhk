-- Issue #582 — centre case 3-stage reveal.
--
-- organizations.show_public_name: a centre may opt into showing its name on
-- the public board / detail BEFORE a tutor accepts the lead ("light public
-- name"). Default off: Stage 1 renders "Verified Centre Partner" and the
-- full name leaves the server only after the tutor has applied or matches
-- the case (viewer-aware in getPublicCaseByCode).

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS show_public_name boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organizations.show_public_name IS
  '#582: light public name opt-in — show the centre name on Stage 1 (pre-accept) case surfaces.';
