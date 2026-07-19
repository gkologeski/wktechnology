
CREATE TABLE public.legal_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  code text,
  name text NOT NULL,
  trade_name text,
  cnpj text,
  ie text,
  im text,
  address_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  logo_url text,
  nfse_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  payments_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX legal_entities_workspace_idx ON public.legal_entities(workspace_id);
CREATE UNIQUE INDEX legal_entities_workspace_code_key ON public.legal_entities(workspace_id, lower(code)) WHERE code IS NOT NULL;
CREATE UNIQUE INDEX legal_entities_workspace_cnpj_key ON public.legal_entities(workspace_id, cnpj) WHERE cnpj IS NOT NULL;
CREATE UNIQUE INDEX legal_entities_one_default_per_workspace ON public.legal_entities(workspace_id) WHERE is_default = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_entities TO authenticated;
GRANT ALL ON public.legal_entities TO service_role;

ALTER TABLE public.legal_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_legal_entities_select ON public.legal_entities
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));

CREATE POLICY ws_legal_entities_write ON public.legal_entities
  FOR ALL TO authenticated
  USING (
    workspace_id IN (SELECT current_user_workspaces())
    AND public.is_workspace_admin(auth.uid(), workspace_id)
  )
  WITH CHECK (
    workspace_id IN (SELECT current_user_workspaces())
    AND public.is_workspace_admin(auth.uid(), workspace_id)
  );

CREATE OR REPLACE FUNCTION public.tg_legal_entities_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER legal_entities_touch
BEFORE UPDATE ON public.legal_entities
FOR EACH ROW EXECUTE FUNCTION public.tg_legal_entities_touch();

ALTER TABLE public.financial_bank_accounts
  ADD COLUMN legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL;
CREATE INDEX financial_bank_accounts_legal_entity_idx ON public.financial_bank_accounts(workspace_id, legal_entity_id);

ALTER TABLE public.financial_categories
  ADD COLUMN legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL;

ALTER TABLE public.financial_entries
  ADD COLUMN legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL;
CREATE INDEX financial_entries_legal_entity_idx ON public.financial_entries(workspace_id, legal_entity_id);
CREATE UNIQUE INDEX IF NOT EXISTS financial_entries_workspace_external_ref_key
  ON public.financial_entries(workspace_id, external_ref) WHERE external_ref IS NOT NULL;

ALTER TABLE public.customer_invoices
  ADD COLUMN legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL;

ALTER TABLE public.nfse_invoices
  ADD COLUMN legal_entity_id uuid REFERENCES public.legal_entities(id) ON DELETE SET NULL;
