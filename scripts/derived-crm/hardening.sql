CREATE OR REPLACE FUNCTION public.crm_mark_explicit_title() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$ BEGIN NEW.job_title_source:='explicit'; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS zy_crm_explicit_title ON public.leads;
CREATE TRIGGER zy_crm_explicit_title BEFORE UPDATE OF job_title ON public.leads FOR EACH ROW EXECUTE FUNCTION public.crm_mark_explicit_title();
-- Target-column guard distinguishes explicit NULL-to-NULL from source-only imports.
DO $$ DECLARE body text; BEGIN
 SELECT pg_get_functiondef(oid) INTO body FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='crm_derive_row';
 body:=replace(body,'IF NEW.job_title IS DISTINCT FROM OLD.job_title THEN','IF NEW.job_title_source=''explicit'' OR NEW.job_title IS DISTINCT FROM OLD.job_title THEN');
 EXECUTE body;
END $$;
CREATE OR REPLACE FUNCTION public.crm_catalog_validate() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE r jsonb; pattern text;
BEGIN
 IF jsonb_typeof(NEW.rules)<>'array' OR jsonb_array_length(NEW.rules)>200 OR NEW.version<1 THEN RAISE EXCEPTION 'Invalid derivation catalog'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(NEW.rules) LOOP
  pattern:=r->>'pattern';
  IF jsonb_typeof(r)<>'object' OR coalesce(r->>'priority','') !~ '^[0-9]{1,6}$' OR pattern IS NULL OR length(pattern)>500 OR pattern ~ '[*+?][*+?]' OR pattern LIKE '%\\1%' THEN RAISE EXCEPTION 'Invalid derivation rule'; END IF;
  PERFORM '' ~ pattern;
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crm_catalog_validate ON public.crm_derivation_catalog;
CREATE TRIGGER crm_catalog_validate BEFORE INSERT OR UPDATE ON public.crm_derivation_catalog FOR EACH ROW EXECUTE FUNCTION public.crm_catalog_validate();
