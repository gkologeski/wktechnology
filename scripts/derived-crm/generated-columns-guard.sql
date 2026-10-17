-- Matches the deployed invoker guard. PostgreSQL clears generated NEW values
-- in BEFORE triggers; ignore only generated phone indexes, never their sources.
CREATE OR REPLACE FUNCTION public.crm_is_derivation_backfill(old_row jsonb,new_row jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
SELECT current_user NOT IN ('authenticated','anon','service_role')
 AND auth.uid() IS NULL
 AND coalesce(current_setting('app.crm_derivation_backfill',true),'')='wk-2026-10-16'
 AND old_row->>'workspace_id'='184b9435-0a9b-4334-9e89-8854dc883f5d'
 AND new_row->>'workspace_id'=old_row->>'workspace_id'
 AND (old_row-ARRAY['cargo_resumido','area_atuacao','nivel_hierarquico','cargo_catalog_version','job_title','job_title_source','size_description','updated_at','phone_digits','mobile_phone_digits','whatsapp_digits'])
   = (new_row-ARRAY['cargo_resumido','area_atuacao','nivel_hierarquico','cargo_catalog_version','job_title','job_title_source','size_description','updated_at','phone_digits','mobile_phone_digits','whatsapp_digits'])
$$;