INSERT INTO public.permissions (key, module, resource, action, scope, label_pt, description, is_system) VALUES
 ('techfinance.sales.view.workspace','techfinance','sales','view','workspace',
  'Ver vendas importadas','Exibe as vendas trazidas do Conta Azul (número, data, cliente, situação e valor), somente leitura.', true)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.finance_sales_access(p_ws uuid, p_user uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE c jsonb;
BEGIN
  IF p_ws IS NULL OR p_user IS NULL THEN RETURN false; END IF;
  c := work_subject_context(p_ws, p_user);
  IF c IS NULL OR c->>'actor' IS NULL THEN RETURN false; END IF;
  RETURN COALESCE(c->'keys' ? 'techfinance.sales.view.workspace', false);
END $$;
REVOKE ALL ON FUNCTION public.finance_sales_access(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.finance_sales_access(uuid,uuid) TO authenticated, service_role;

CREATE TABLE public.finance_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'contaazul' CHECK (source IN ('contaazul')),
  external_id text NOT NULL,
  number integer,
  sale_date date,
  kind text,
  items_kind text,
  status text,
  status_label text,
  total numeric(14,2) NOT NULL DEFAULT 0,
  customer_external_id text,
  customer_name text,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  run_id uuid REFERENCES public.contaazul_import_runs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source, external_id)
);
CREATE INDEX finance_sales_ws_date_idx ON public.finance_sales (workspace_id, sale_date DESC);
GRANT SELECT ON public.finance_sales TO authenticated;
GRANT ALL ON public.finance_sales TO service_role;
ALTER TABLE public.finance_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_sales_select ON public.finance_sales FOR SELECT TO authenticated
  USING (public.finance_sales_access(workspace_id, auth.uid()));
COMMENT ON TABLE public.finance_sales IS 'Vendas importadas do Conta Azul (somente leitura no TechERP). Gravadas apenas pela importação autorizada no servidor.';