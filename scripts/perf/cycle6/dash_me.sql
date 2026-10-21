\set u random(1, 400)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', 'b0000000-0000-4000-8000-' || lpad(:u::text, 12, '0'), 'role', 'authenticated')::text, true);
SELECT length(public.project_dash_summary('me', '{"from":"2026-01-01","to":"2026-01-31","tz":"America/Sao_Paulo"}'::jsonb)::text);
COMMIT;
