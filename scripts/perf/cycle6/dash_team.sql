BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SELECT length(public.project_dash_summary('team', '{"from":"2026-01-01","to":"2026-01-31","tz":"America/Sao_Paulo"}'::jsonb)::text);
COMMIT;
