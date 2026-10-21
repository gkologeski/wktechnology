\set u random(1, 400)
\set d random(0, 59)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', 'b0000000-0000-4000-8000-' || lpad(:u::text, 12, '0'), 'role', 'authenticated')::text, true);
SELECT public.project_time_entry_sync('aaaaaaaa-0000-4000-8000-00000000000a', gen_random_uuid(), md5(random()::text) || md5(random()::text),
  jsonb_build_object('project_id', 'b1000000-0000-4000-8000-' || lpad(((:u % 40) + 1)::text, 12, '0'),
                     'task_id', 'b2000000-0000-4000-8000-' || lpad(((:u % 40) * 50 + 1)::text, 12, '0'),
                     'entry_date', (date '2026-08-01' + :d)::text, 'mode', 'duration', 'duration_seconds', 1800));
COMMIT;
