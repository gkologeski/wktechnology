\set u random(1, 400)
BEGIN;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT length(public.project_api_list_time_entries(('c7000000-0000-4000-8000-' || lpad(:u::text, 12, '0'))::uuid,
  ('b0000000-0000-4000-8000-' || lpad(:u::text, 12, '0'))::uuid, 'aaaaaaaa-0000-4000-8000-00000000000a',
  null, null, null, '2026-01-01', '2026-01-31', false, 50, 0)::text);
COMMIT;
