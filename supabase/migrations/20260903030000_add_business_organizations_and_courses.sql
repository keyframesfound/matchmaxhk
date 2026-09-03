-- =========================================================
-- Business section: organizations, members, courses
-- Plans: business (10 courses, owner + 1 admin) / enterprise (unlimited, owner + 20 admins)
-- =========================================================

-- ============ ENUMS ============
CREATE TYPE public.org_plan AS ENUM ('business', 'enterprise');
CREATE TYPE public.org_status AS ENUM ('pending', 'active', 'suspended');
CREATE TYPE public.org_member_role AS ENUM ('owner', 'admin');
CREATE TYPE public.org_member_status AS ENUM ('pending', 'active', 'revoked');

-- ============ ORGANIZATIONS ============
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  website_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  whatsapp_number TEXT,
  district TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
  plan public.org_plan NOT NULL DEFAULT 'business',
  status public.org_status NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.organizations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_organizations_created_by ON public.organizations(created_by);
CREATE INDEX idx_organizations_status ON public.organizations(status);

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ORGANIZATION MEMBERS ============
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role public.org_member_role NOT NULL DEFAULT 'admin',
  status public.org_member_status NOT NULL DEFAULT 'pending',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

-- Only one (non-revoked) owner per organization
CREATE UNIQUE INDEX idx_organization_members_single_owner
  ON public.organization_members(organization_id)
  WHERE role = 'owner' AND status <> 'revoked';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_organization_members_org ON public.organization_members(organization_id);
CREATE INDEX idx_organization_members_user ON public.organization_members(user_id);
CREATE INDEX idx_organization_members_email ON public.organization_members(lower(email));

-- ============ COURSES ============
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  description TEXT,
  subject TEXT,
  level TEXT,
  mode public.case_mode NOT NULL DEFAULT 'either',
  price NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'HKD',
  schedule_text TEXT,
  district TEXT,
  image_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.courses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT ALL ON public.courses TO service_role;

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_courses_org ON public.courses(organization_id);
CREATE INDEX idx_courses_published ON public.courses(is_published);

CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PLAN LIMIT TRIGGERS ============
CREATE OR REPLACE FUNCTION public.enforce_course_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.org_plan;
  v_count INTEGER;
BEGIN
  SELECT plan INTO v_plan FROM public.organizations WHERE id = NEW.organization_id;
  IF v_plan = 'business' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.courses
    WHERE organization_id = NEW.organization_id;
    IF v_count >= 10 THEN
      RAISE EXCEPTION 'Course limit reached for the Business plan (max 10). Upgrade to Enterprise for unlimited courses.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_courses_plan_limit
  BEFORE INSERT ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_course_limit();

CREATE OR REPLACE FUNCTION public.enforce_member_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.org_plan;
  v_max INTEGER;
  v_count INTEGER;
BEGIN
  SELECT plan INTO v_plan FROM public.organizations WHERE id = NEW.organization_id;
  v_max := CASE WHEN v_plan = 'enterprise' THEN 21 ELSE 2 END;
  SELECT COUNT(*) INTO v_count
  FROM public.organization_members
  WHERE organization_id = NEW.organization_id
    AND status IN ('pending', 'active');
  IF v_count >= v_max THEN
    RAISE EXCEPTION 'Team member limit reached for the current plan.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organization_members_plan_limit
  BEFORE INSERT ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_limit();

-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.get_org_role(_org_id UUID, _user_id UUID DEFAULT auth.uid())
RETURNS public.org_member_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.role
  FROM public.organization_members om
  WHERE om.organization_id = _org_id
    AND om.user_id = _user_id
    AND om.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_org_role(_org_id) = 'owner';
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_org_role(_org_id) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.org_is_active(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = _org_id AND status = 'active'
  );
$$;

-- Called after sign-in/sign-up: pending invites for this email become active memberships
CREATE OR REPLACE FUNCTION public.claim_org_memberships()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 0;
  END IF;
  UPDATE public.organization_members om
  SET user_id = auth.uid(),
      status = 'active',
      claimed_at = now()
  WHERE om.status = 'pending'
    AND om.user_id IS NULL
    AND lower(om.email) = lower(auth.email());
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Prevent non-platform-admins from changing plan / status / slug / created_by
CREATE OR REPLACE FUNCTION public.protect_org_managed_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role') OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF (NEW.plan, NEW.status, NEW.slug, NEW.created_by) IS DISTINCT FROM (OLD.plan, OLD.status, OLD.slug, OLD.created_by) THEN
    IF NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'Only platform admins can change organization plan, status or slug';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organizations_protect_managed_columns
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.protect_org_managed_columns();

-- EXECUTE grants (follow has_role pattern)
REVOKE ALL ON FUNCTION public.get_org_role(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_role(UUID, UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_org_owner(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_owner(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_org_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.org_is_active(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_is_active(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_org_memberships() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_org_memberships() TO authenticated, service_role;

-- Trigger functions are never invoked via RPC; lock them down entirely
REVOKE ALL ON FUNCTION public.enforce_course_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_member_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_org_managed_columns() FROM PUBLIC, anon, authenticated;

-- Harden pre-existing function (security advisor lint)
ALTER FUNCTION public.tutor_card_highlights_valid(text[]) SET search_path = public;

-- ============ RLS: ORGANIZATIONS ============
CREATE POLICY "Public can view active organizations"
  ON public.organizations FOR SELECT TO anon
  USING (status = 'active');

CREATE POLICY "Members and platform admins can view organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    status = 'active'
    OR created_by = auth.uid()
    OR public.is_org_admin(id)
    OR public.is_platform_admin()
  );

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Org admins and platform admins can update organizations"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_org_admin(id) OR public.is_platform_admin())
  WITH CHECK (public.is_org_admin(id) OR public.is_platform_admin());

CREATE POLICY "Org owners and platform admins can delete organizations"
  ON public.organizations FOR DELETE TO authenticated
  USING (public.is_org_owner(id) OR public.is_platform_admin());

-- ============ RLS: ORGANIZATION MEMBERS ============
CREATE POLICY "Org members and platform admins can view members"
  ON public.organization_members FOR SELECT TO authenticated
  USING (
    public.is_org_admin(organization_id)
    OR public.is_platform_admin()
    OR user_id = auth.uid()
  );

CREATE POLICY "Org admins can invite members"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "Org owners and platform admins can manage members"
  ON public.organization_members FOR UPDATE TO authenticated
  USING (public.is_org_owner(organization_id) OR public.is_platform_admin());

CREATE POLICY "Owners remove members, admins can leave"
  ON public.organization_members FOR DELETE TO authenticated
  USING (
    public.is_org_owner(organization_id)
    OR public.is_platform_admin()
    OR (user_id = auth.uid() AND role = 'admin')
  );

-- ============ RLS: COURSES ============
CREATE POLICY "Public can view published courses of active orgs"
  ON public.courses FOR SELECT TO anon
  USING (
    is_published
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = courses.organization_id AND o.status = 'active'
    )
  );

CREATE POLICY "Authenticated can view published courses or manage own org courses"
  ON public.courses FOR SELECT TO authenticated
  USING (
    (
      is_published
      AND EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = courses.organization_id AND o.status = 'active'
      )
    )
    OR public.is_org_admin(organization_id)
    OR public.is_platform_admin()
  );

CREATE POLICY "Org admins can create courses"
  ON public.courses FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id));

CREATE POLICY "Org admins and platform admins can update courses"
  ON public.courses FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id) OR public.is_platform_admin());

CREATE POLICY "Org admins and platform admins can delete courses"
  ON public.courses FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id) OR public.is_platform_admin());
