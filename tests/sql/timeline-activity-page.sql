BEGIN;
CREATE TEMP TABLE r(k text, v jsonb);
DO $$ DECLARE d uuid := gen_random_uuid(); w uuid; u uuid; r1 jsonb; r2 jsonb; BEGIN
 SELECT workspace_id INTO w FROM public.deals LIMIT 1;
 SELECT user_id INTO u FROM public.workspace_members WHERE workspace_id=w LIMIT 1;
 INSERT INTO public.deals(id,workspace_id,owner_id,name) VALUES (d,w,u,'fixture-c3');
 INSERT INTO public.activities(owner_id,workspace_id,type,subject,related_deal_id,created_at,assigned_to,external_ids)
  SELECT u,w,(CASE WHEN g<=30 THEN 'note' ELSE 'call' END)::activity_type,'fx '||g,d,'2026-01-01'::timestamptz,CASE WHEN g%3=0 THEN NULL ELSE u END,
  CASE WHEN g=1 THEN '{"email_message_id":"zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz"}'::jsonb WHEN g=2 THEN '{"email_message_id":"------------------------------------"}'::jsonb ELSE '{}'::jsonb END
  FROM generate_series(1,45) g;
 r1 := public.get_timeline_activity_page('deal',d);
 INSERT INTO r VALUES('p1',jsonb_build_object('n',jsonb_array_length(r1->'items'),'total',r1->'total','counts',r1->'counts','more',r1->'has_more'));
 r2 := public.get_timeline_activity_page('deal',d,p_cursor_at:=(r1->>'next_at')::timestamptz,p_cursor_id:=(r1->>'next_id')::uuid);
 INSERT INTO r VALUES('p2',jsonb_build_object('n',jsonb_array_length(r2->'items'),'more',r2->'has_more','overlap',(SELECT count(*) FROM jsonb_array_elements(r1->'items') a JOIN jsonb_array_elements(r2->'items') b ON a->>'id'=b->>'id')));
 INSERT INTO r VALUES('calls',(public.get_timeline_activity_page('deal',d,p_categories:=ARRAY['call']))->'total');
 INSERT INTO r VALUES('unassigned_only',(public.get_timeline_activity_page('deal',d,p_include_unassigned:=true))->'total');
 INSERT INTO r VALUES('user_only',(public.get_timeline_activity_page('deal',d,p_assignees:=ARRAY[u]))->'total');
 INSERT INTO r VALUES('search_bad_uuid',(public.get_timeline_activity_page('deal',d,p_search:='inexistente'))->'total');
 INSERT INTO r VALUES('empty',public.get_timeline_activity_page('deal',gen_random_uuid()));
END $$;
SELECT * FROM r;
ROLLBACK;
