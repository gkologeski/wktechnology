
-- service_catalog: catálogo de serviços de TI (separado da tabela `services` operacional)
CREATE TABLE public.service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  code text,
  description text,
  category text,
  service_type text NOT NULL DEFAULT 'one_off',
    -- one_off | recurring | hour_bank | sla | project | subscription
  unit text NOT NULL DEFAULT 'hour',
    -- hour | month | pf | unit | day | user | GB | fixed
  base_price numeric(14,2) NOT NULL DEFAULT 0,
  cost numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  tax_rate numeric(6,3) NOT NULL DEFAULT 0,
  default_sla_hours integer,
  competencies text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_catalog_type_chk CHECK (service_type IN
    ('one_off','recurring','hour_bank','sla','project','subscription'))
);

CREATE INDEX service_catalog_workspace_active_idx
  ON public.service_catalog (workspace_id, active);
CREATE INDEX service_catalog_name_trgm_idx
  ON public.service_catalog USING gin (name gin_trgm_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_catalog TO authenticated;
GRANT ALL ON public.service_catalog TO service_role;

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws_select_service_catalog ON public.service_catalog
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));

CREATE POLICY ws_insert_service_catalog ON public.service_catalog
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

CREATE POLICY ws_update_service_catalog ON public.service_catalog
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));

CREATE POLICY ws_delete_service_catalog ON public.service_catalog
  FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));

CREATE TRIGGER update_service_catalog_updated_at
  BEFORE UPDATE ON public.service_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- View unificada para pickers: Produtos + Serviços com colunas normalizadas.
CREATE OR REPLACE VIEW public.catalog_items
WITH (security_invoker = true) AS
SELECT
  'product'::text  AS kind,
  p.id,
  p.workspace_id,
  p.owner_id,
  p.name,
  p.sku          AS code,
  p.description,
  NULL::text     AS category,
  'product'::text AS type,
  p.unit,
  p.unit_price   AS base_price,
  p.currency,
  p.tax_rate,
  p.active,
  p.created_at,
  p.updated_at
FROM public.products p
UNION ALL
SELECT
  'service'::text AS kind,
  s.id,
  s.workspace_id,
  s.owner_id,
  s.name,
  s.code,
  s.description,
  s.category,
  s.service_type AS type,
  s.unit,
  s.base_price,
  s.currency,
  s.tax_rate,
  s.active,
  s.created_at,
  s.updated_at
FROM public.service_catalog s;

GRANT SELECT ON public.catalog_items TO authenticated;
