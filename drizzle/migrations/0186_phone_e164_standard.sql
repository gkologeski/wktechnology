-- Padrão E.164 de telefones (aditivo; nada muda para quem não usa).

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS default_phone_country text NOT NULL DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS phone_strict_e164 boolean NOT NULL DEFAULT false;
DO $$ BEGIN
  ALTER TABLE public.workspaces
    ADD CONSTRAINT workspaces_default_phone_country_chk CHECK (default_phone_country ~ '^[A-Z]{2}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
COMMENT ON COLUMN public.workspaces.default_phone_country IS
  'País (ISO 3166-1 alfa-2) usado só para números novos digitados sem +DDI. Não prova o país de dados históricos.';
COMMENT ON COLUMN public.workspaces.phone_strict_e164 IS
  'Quando true, o banco recusa telefone alterado fora da FORMA E.164 (+ e até 15 dígitos). Checa só a forma; a validação completa é do app (libphonenumber).';

ALTER TABLE public.contacts  ADD COLUMN IF NOT EXISTS phone_ext text;
ALTER TABLE public.leads     ADD COLUMN IF NOT EXISTS phone_ext text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone_ext text;
DO $$ BEGIN
  ALTER TABLE public.contacts  ADD CONSTRAINT contacts_phone_ext_chk  CHECK (phone_ext IS NULL OR phone_ext ~ '^\d{1,7}$');
  ALTER TABLE public.leads     ADD CONSTRAINT leads_phone_ext_chk     CHECK (phone_ext IS NULL OR phone_ext ~ '^\d{1,7}$');
  ALTER TABLE public.companies ADD CONSTRAINT companies_phone_ext_chk CHECK (phone_ext IS NULL OR phone_ext ~ '^\d{1,7}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.workspace_phone_country(_workspace uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT default_phone_country FROM public.workspaces WHERE id = _workspace), 'BR')
$$;
REVOKE ALL ON FUNCTION public.workspace_phone_country(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.workspace_phone_country(uuid) TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.phone_normalization_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  normalizer_version text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('dry_run','apply','rollback')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','failed','rolled_back')),
  criteria text NOT NULL,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.phone_normalization_items (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.phone_normalization_runs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  table_name text NOT NULL,
  row_id uuid NOT NULL,
  column_name text NOT NULL,
  original_value text,
  proposed_value text,
  proposed_ext text,
  classification text NOT NULL,
  reason text,
  applied_at timestamptz,
  rolled_back_at timestamptz,
  UNIQUE (run_id, table_name, row_id, column_name)
);
CREATE INDEX IF NOT EXISTS phone_norm_items_ws_cls_idx
  ON public.phone_normalization_items (workspace_id, classification, table_name);
CREATE INDEX IF NOT EXISTS phone_norm_items_pending_idx
  ON public.phone_normalization_items (run_id) WHERE applied_at IS NULL;

GRANT SELECT ON public.phone_normalization_runs  TO authenticated;
GRANT SELECT ON public.phone_normalization_items TO authenticated;
GRANT ALL ON public.phone_normalization_runs  TO service_role;
GRANT ALL ON public.phone_normalization_items TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.phone_normalization_items_id_seq TO service_role;

ALTER TABLE public.phone_normalization_runs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_normalization_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY phone_norm_runs_admin_read ON public.phone_normalization_runs
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid())
         AND public.is_workspace_admin_v2(workspace_id, auth.uid()));
CREATE POLICY phone_norm_items_admin_read ON public.phone_normalization_items
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid())
         AND public.is_workspace_admin_v2(workspace_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.crm_is_derivation_backfill(old_row jsonb, new_row jsonb)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$ SELECT current_user NOT IN ('authenticated','anon','service_role') AND auth.uid() IS NULL AND old_row->>'workspace_id'='184b9435-0a9b-4334-9e89-8854dc883f5d' AND new_row->>'workspace_id'=old_row->>'workspace_id' AND (
  (coalesce(current_setting('app.crm_derivation_backfill',true),'')='wk-2026-10-16' AND (old_row-ARRAY['cargo_resumido','area_atuacao','nivel_hierarquico','cargo_catalog_version','job_title','job_title_source','size_description','updated_at','phone_digits','mobile_phone_digits','whatsapp_digits'])=(new_row-ARRAY['cargo_resumido','area_atuacao','nivel_hierarquico','cargo_catalog_version','job_title','job_title_source','size_description','updated_at','phone_digits','mobile_phone_digits','whatsapp_digits']))
  OR
  (coalesce(current_setting('app.phone_e164_backfill',true),'')='wk-phone-e164-v1' AND (old_row-ARRAY['phone','mobile_phone','phone_ext','emergency_phone','updated_at','phone_digits','mobile_phone_digits','whatsapp_e164','whatsapp_digits'])=(new_row-ARRAY['phone','mobile_phone','phone_ext','emergency_phone','updated_at','phone_digits','mobile_phone_digits','whatsapp_e164','whatsapp_digits']))
) $function$;

CREATE OR REPLACE FUNCTION public.phone_e164_shape_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_col text;
  v_new text;
  v_old text;
  v_strict boolean;
  v_checked boolean := false;
BEGIN
  FOREACH v_col IN ARRAY TG_ARGV LOOP
    v_new := to_jsonb(NEW)->>v_col;
    v_old := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD)->>v_col END;
    IF v_new IS NOT NULL AND v_new IS DISTINCT FROM v_old AND v_new !~ '^\+[1-9][0-9]{1,14}$' THEN
      IF NOT v_checked THEN
        SELECT w.phone_strict_e164 INTO v_strict FROM public.workspaces w WHERE w.id = NEW.workspace_id;
        v_checked := true;
      END IF;
      IF COALESCE(v_strict, false) THEN
        RAISE EXCEPTION 'Telefone fora do padrão E.164 (+código do país e número).'
          USING ERRCODE = '22023', COLUMN = v_col;
      END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_phone_e164_guard ON public.contacts;
CREATE TRIGGER trg_phone_e164_guard BEFORE INSERT OR UPDATE OF phone, mobile_phone ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.phone_e164_shape_guard('phone','mobile_phone');
DROP TRIGGER IF EXISTS trg_phone_e164_guard ON public.leads;
CREATE TRIGGER trg_phone_e164_guard BEFORE INSERT OR UPDATE OF phone, mobile_phone ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.phone_e164_shape_guard('phone','mobile_phone');
DROP TRIGGER IF EXISTS trg_phone_e164_guard ON public.companies;
CREATE TRIGGER trg_phone_e164_guard BEFORE INSERT OR UPDATE OF phone ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.phone_e164_shape_guard('phone');
DROP TRIGGER IF EXISTS trg_phone_e164_guard ON public.people;
CREATE TRIGGER trg_phone_e164_guard BEFORE INSERT OR UPDATE OF phone, emergency_phone ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.phone_e164_shape_guard('phone','emergency_phone');
DROP TRIGGER IF EXISTS trg_phone_e164_guard ON public.ats_candidates;
CREATE TRIGGER trg_phone_e164_guard BEFORE INSERT OR UPDATE OF phone ON public.ats_candidates
  FOR EACH ROW EXECUTE FUNCTION public.phone_e164_shape_guard('phone');
DROP TRIGGER IF EXISTS trg_phone_e164_guard ON public.ats_referrals;
CREATE TRIGGER trg_phone_e164_guard BEFORE INSERT OR UPDATE OF candidate_phone ON public.ats_referrals
  FOR EACH ROW EXECUTE FUNCTION public.phone_e164_shape_guard('candidate_phone');
DROP TRIGGER IF EXISTS trg_phone_e164_guard ON public.bookings;
CREATE TRIGGER trg_phone_e164_guard BEFORE INSERT OR UPDATE OF invitee_phone ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.phone_e164_shape_guard('invitee_phone');
