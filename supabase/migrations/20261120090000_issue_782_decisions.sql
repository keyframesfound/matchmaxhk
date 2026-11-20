-- #782 CEO decisions (2026-11-20).
--
-- (1) AC-703-3 strike ladder: add the no-show category to behaviour reports.
-- (2) Contraband check at the DB for every direct write to public.tutors
--     (bio, headlines, any text column). Mirrors screenContraband in
--     src/features/trust/safety-screen.ts; keep the two in sync. Only CHANGED
--     columns are scanned, so legacy rows never block an unrelated update.

alter table public.behaviour_reports drop constraint if exists behaviour_reports_category_check;
alter table public.behaviour_reports add constraint behaviour_reports_category_check
  check (category in ('unresponsive', 'no_show', 'hostile', 'boundary', 'safety_concern', 'other'));

create or replace function public.contraband_category(_text text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  trade constant text := '(\m(sell(ing)?|for\s+sale|buy(ing)?|supplier|dealer|cheap|wholesale)\M|出售|有售|買|买|賣|卖|代購|代购|送貨|送货|批發|批发|平價|平价)';
  drug constant text := '(\m(cannabis|marijuana|weed|cocaine|ketamine|meth|mdma|ecstasy|lsd|xanax|vapes?)\M|電子煙|电子烟|大麻|可卡因|搖頭丸|摇头丸|毒品)';
  weapon constant text := '(\m(guns?|pistols?|rifles?|ammo|ammunition|tasers?|stun\s*guns?|pepper\s*spray|knuckle\s*dusters?|switchblades?)\M|槍|枪|子彈|子弹|武器)';
begin
  if _text is null or _text = '' then
    return null;
  end if;
  if _text ~* ('太空油|依托咪酯|etomidate|k\s*仔|冰毒|大麻油|大麻糖|thc\s*(carts?|vapes?|oil|gumm(y|ies))|cbd\s*(oil|vapes?|gumm(y|ies))|vape\s*juice|電子煙油|电子烟油|weed\s*(delivery|for\s+sale)|420\s*friendly|'
               || trade || '.{0,20}' || drug || '|' || drug || '.{0,20}' || trade) then
    return 'drugs';
  end if;
  if _text ~* ('電槍|电枪|伸縮棍|伸缩棍|攻擊性武器出售|攻击性武器出售|槍械出售|枪械出售|3d\s*printed\s*guns?|ghost\s*guns?|'
               || trade || '.{0,20}' || weapon) then
    return 'weapons';
  end if;
  if _text ~* 'online\s*casino|sports?\s*betting|betting\s*tips|bet365|百家樂|百家乐|外圍波|外围波|網上賭場|网上赌场|賭場代理|赌场代理|賭波貼士|赌波贴士' then
    return 'gambling';
  end if;
  if _text ~* '\mporn(o|ography)?\M|\mnsfw\M|\mnudes?\M|\monlyfans\M|escort\s*service|\m18\+\s*(content|videos?|pics?)|援交|色情|裸照|成人影片' then
    return 'explicit';
  end if;
  if _text ~* 'leaked\s*(exam|paper|questions?|answers?)|exam\s*leak|pirated\s*(exam|papers?|textbooks?)|real\s*exam\s*questions?\s*before|洩題|泄题|泄題|試卷外洩|试卷外泄|偷題|偷题|盜版試卷|盗版试卷' then
    return 'pirated_exams';
  end if;
  return null;
end;
$$;

create or replace function public.tutors_contraband_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  rec record;
  old_json jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  hit text;
begin
  for rec in select key, value from jsonb_each(to_jsonb(new)) loop
    continue when jsonb_typeof(rec.value) not in ('string', 'array', 'object');
    continue when tg_op = 'UPDATE' and rec.value is not distinct from (old_json -> rec.key);
    hit := public.contraband_category(
      case when jsonb_typeof(rec.value) = 'string' then rec.value #>> '{}' else rec.value::text end
    );
    if hit is not null then
      raise exception 'This can''t be saved: it mentions content MatchMax does not allow (%). / 未能儲存：內容涉及 MatchMax 不容許的內容（%）。', hit, hit
        using errcode = 'P0001';
    end if;
  end loop;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_tutors_contraband_guard' and tgrelid = 'public.tutors'::regclass
  ) then
    create trigger trg_tutors_contraband_guard
      before insert or update on public.tutors
      for each row execute function public.tutors_contraband_guard();
  end if;
end $$;
