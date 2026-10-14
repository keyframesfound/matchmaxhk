-- Issue #313: Note kinds — curriculum/subject/type classification plus
-- exemplar fields for the digital_materials marketplace.
alter table public.digital_materials
  add column if not exists material_type text not null default 'notes',
  add column if not exists topic text,
  add column if not exists grade_achieved text,
  add column if not exists exemplar_permission boolean not null default false;

alter table public.digital_materials
  add constraint digital_materials_material_type_check
  check (material_type in ('notes', 'mock', 'exemplar'));

-- Backfill: legacy document types map onto the new 3-way type. Only
-- mock_exam maps to 'mock'; coursework types (ia/ee/tok_essay) become
-- 'notes' — they never carried the written-permission confirmation the
-- exemplar type requires, so they must not claim exemplar status.
update public.digital_materials
  set material_type = 'mock'
  where document_type = 'mock_exam';
