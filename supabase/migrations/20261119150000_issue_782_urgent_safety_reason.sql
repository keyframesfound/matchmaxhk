-- #782 §2.4 (was #755): add the Urgent Safety / contraband report reason.
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check check (reason = any (array['contact_details','inappropriate_image','copyright','fake_credentials','not_as_described','harassment','spam','impersonation','other','urgent_safety']));
