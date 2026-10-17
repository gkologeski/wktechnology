-- Run one transaction per invocation through the authorized data tool, not a migration.
-- Re-run only after checking the result; max 1,000 rows per entity per invocation.
BEGIN;
SET LOCAL app.crm_derivation_backfill='wk-2026-10-16';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.crm_derivation_catalog WHERE workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d' AND version=2 AND active) THEN RAISE EXCEPTION 'Corrected catalog v2 must be active first'; END IF;
END $$;
WITH batch AS (SELECT id FROM public.contacts WHERE workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d' AND deleted_at IS NULL AND cargo_catalog_version IS DISTINCT FROM 2 ORDER BY id LIMIT 1000), changed AS (
 UPDATE public.contacts c SET cargo_catalog_version=2 FROM batch WHERE c.id=batch.id RETURNING c.id
) SELECT 'contacts' AS entity,count(*) AS updated FROM changed;
WITH batch AS (SELECT id FROM public.leads WHERE workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d' AND deleted_at IS NULL AND cargo_catalog_version IS DISTINCT FROM 2 ORDER BY id LIMIT 1000), changed AS (
 UPDATE public.leads l SET cargo_catalog_version=2 FROM batch WHERE l.id=batch.id RETURNING l.id
) SELECT 'leads' AS entity,count(*) AS updated FROM changed;
WITH batch AS (SELECT id FROM public.companies WHERE workspace_id='184b9435-0a9b-4334-9e89-8854dc883f5d' AND deleted_at IS NULL AND size_description IS DISTINCT FROM public.crm_size_description(size) ORDER BY id LIMIT 1000), changed AS (
 UPDATE public.companies c SET size_description=public.crm_size_description(c.size) FROM batch WHERE c.id=batch.id RETURNING c.id
) SELECT 'companies' AS entity,count(*) AS updated FROM changed;
COMMIT;