-- Fixture isolada (ROLLBACK). Valida grupos indivisíveis, >300 grupos, empates, filtros e calendário dedup.
BEGIN;
CREATE TEMP TABLE r(k text, v jsonb);
DO $$ DECLARE d uuid := gen_random_uuid(); w uuid; u uuid; c uuid := gen_random_uuid(); ce1 uuid := gen_random_uuid(); ce2 uuid := gen_random_uuid();
 p jsonb; cur_at timestamptz; cur_id uuid; seen int := 0; pages int := 0; changes int := 0; dup int; v_all uuid[] := '{}'; BEGIN
 SELECT workspace_id INTO w FROM public.deals LIMIT 1;
 SELECT user_id INTO u FROM public.workspace_members WHERE workspace_id=w LIMIT 1;
 INSERT INTO public.deals(id,workspace_id,owner_id,name) VALUES (d,w,u,'fixture-c3-hist');
 -- 350 grupos: cada grupo tem 3 alterações no mesmo segundo; grupos 1..10 compartilham o mesmo instante (empate) com autores alternados.
 INSERT INTO public.property_history(owner_id,entity,entity_id,property,old_value,new_value,changed_at,changed_by)
 SELECT u,'deals',d,pr,to_jsonb('a'||g),to_jsonb('b'||g||'-marcador'),
   CASE WHEN g<=10 THEN '2026-01-01 12:00:00'::timestamptz ELSE '2026-01-01'::timestamptz - (g||' minutes')::interval END,
   CASE WHEN g<=10 AND g%2=0 THEN NULL ELSE u END
 FROM generate_series(1,350) g, unnest(ARRAY['stage_id','amount','assigned_to']) pr;
 LOOP
   p := public.get_timeline_history_page('deals',d,p_cursor_at:=cur_at,p_cursor_id:=cur_id);
   pages := pages+1; seen := seen + jsonb_array_length(p->'items');
   SELECT changes + COALESCE(sum(jsonb_array_length(i->'changes')),0) INTO changes FROM jsonb_array_elements(p->'items') i;
   v_all := v_all || ARRAY(SELECT (i->>'id')::uuid FROM jsonb_array_elements(p->'items') i);
   EXIT WHEN NOT (p->>'has_more')::boolean OR pages>50;
   cur_at := (p->>'next_at')::timestamptz; cur_id := (p->>'next_id')::uuid;
 END LOOP;
 SELECT count(*)-count(DISTINCT x) INTO dup FROM unnest(v_all) x;
 INSERT INTO r VALUES('hist_walk',jsonb_build_object('groups',seen,'changes',changes,'pages',pages,'dup',dup,'total',(public.get_timeline_history_page('deals',d))->'total'));
 INSERT INTO r VALUES('hist_owner_only',(public.get_timeline_history_page('deals',d,p_categories:=ARRAY['owner']))->'counts');
 INSERT INTO r VALUES('hist_unassigned',(public.get_timeline_history_page('deals',d,p_include_unassigned:=true))->'total');
 INSERT INTO r VALUES('hist_search',(public.get_timeline_history_page('deals',d,p_search:='b123-marcador'))->'total');
 -- calendário: ce1 via atividade do negócio (virtual), ce2 já espelhado por outra atividade com calendar_event_id → excluído.
 INSERT INTO public.activities(id,owner_id,workspace_id,type,subject,related_deal_id) VALUES (c,u,w,'note','link',d);
 INSERT INTO public.calendar_events(provider_event_id,id,workspace_id,owner_id,title,start_at,end_at,related_activity_id) VALUES
  ('fx-c3-a',ce1,w,u,'Reunião fixture A','2026-02-01','2026-02-01 01:00',c),('fx-c3-b',ce2,w,u,'Reunião fixture B','2026-02-02','2026-02-02 01:00',c);
 INSERT INTO public.activities(owner_id,workspace_id,type,subject,related_deal_id,external_ids) VALUES (u,w,'meeting','espelho',d,jsonb_build_object('calendar_event_id',ce2::text));
 p := public.get_timeline_calendar_page('deal',d);
 INSERT INTO r VALUES('cal',jsonb_build_object('total',p->'total','ids_ok',(p->'items'->0->>'id')=ce1::text));
 INSERT INTO r VALUES('cal_search',(public.get_timeline_calendar_page('deal',d,p_search:='fixture B'))->'total');
END $$;
SELECT * FROM r;
ROLLBACK;
