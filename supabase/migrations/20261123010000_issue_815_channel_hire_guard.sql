-- #815 §2.2 AC-CH-3: a Partner Centre channel is never a careers page.
-- Reject Hire / Recruit / Vacancy / Apply-to-centre / wage wording in the
-- public org text and course cards, server-side (mirrors HIRE_LANGUAGE in
-- src/features/business/centre-channel.ts). Only changed text is checked.

CREATE OR REPLACE FUNCTION public.has_hire_language(t text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    t ~* '\m(hire|hiring|recruit|recruiting|recruitment|vacancy|vacancies|job openings?|salary|wages?)\M'
    OR t ~* 'apply to (the )?centre'
    OR t ~ '(招聘|聘請|職位空缺|薪金|薪酬|應徵)',
    false);
$$;

CREATE OR REPLACE FUNCTION public.trg_channel_hire_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  new_text text;
  old_text text := '';
BEGIN
  IF TG_TABLE_NAME = 'organizations' THEN
    new_text := concat_ws(' ', NEW.name, NEW.tagline, NEW.description);
    IF TG_OP = 'UPDATE' THEN
      old_text := concat_ws(' ', OLD.name, OLD.tagline, OLD.description);
    END IF;
  ELSE
    new_text := concat_ws(' ', NEW.title, NEW.summary, NEW.description);
    IF TG_OP = 'UPDATE' THEN
      old_text := concat_ws(' ', OLD.title, OLD.summary, OLD.description);
    END IF;
  END IF;
  IF new_text IS DISTINCT FROM old_text AND public.has_hire_language(new_text) THEN
    RAISE EXCEPTION 'Partner Centre pages cannot advertise jobs, vacancies or wages. MatchMax is not an employment agency. / 合作中心頁面不可刊登招聘、職位空缺或薪酬資訊。'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_organizations_hire_guard
  BEFORE INSERT OR UPDATE OF name, tagline, description ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.trg_channel_hire_guard();

CREATE OR REPLACE TRIGGER trg_courses_hire_guard
  BEFORE INSERT OR UPDATE OF title, summary, description ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.trg_channel_hire_guard();
