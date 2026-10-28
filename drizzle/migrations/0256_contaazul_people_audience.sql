ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'sales';
ALTER TABLE public.companies ADD CONSTRAINT companies_audience_check CHECK (audience IN ('sales','finance'));
CREATE INDEX IF NOT EXISTS companies_workspace_audience_idx ON public.companies (workspace_id, audience);
COMMENT ON COLUMN public.companies.audience IS 'sales = aparece no TechSales; finance = cliente/fornecedor somente financeiro (ex.: vindo do Conta Azul).';
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'sales';
ALTER TABLE public.contacts ADD CONSTRAINT contacts_audience_check CHECK (audience IN ('sales','finance'));
CREATE INDEX IF NOT EXISTS contacts_workspace_audience_idx ON public.contacts (workspace_id, audience);
COMMENT ON COLUMN public.contacts.audience IS 'sales = aparece no TechSales; finance = somente financeiro.';

INSERT INTO public.permissions (key, module, resource, action, scope, label_pt, description, is_system) VALUES
 ('techfinance.contaazul_people.view.workspace','techfinance','contaazul_people','view','workspace',
  'Ver clientes e fornecedores do Conta Azul','Exibe a conciliação de clientes e fornecedores do Conta Azul com Empresas e Contatos.', true),
 ('techfinance.contaazul_people.manage.workspace','techfinance','contaazul_people','manage','workspace',
  'Conciliar clientes e fornecedores do Conta Azul','Confirma, troca ou ignora vínculos sugeridos e decide quais entram como somente financeiro.', true)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.contaazul_people_access(p_ws uuid, p_user uuid, p_action text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE c jsonb;
BEGIN
  IF p_ws IS NULL OR p_user IS NULL OR p_action NOT IN ('view','manage') THEN RETURN false; END IF;
  c := work_subject_context(p_ws, p_user);
  IF c IS NULL OR c->>'actor' IS NULL THEN RETURN false; END IF;
  IF p_action = 'manage' AND COALESCE((c->>'read_only')::boolean, false) THEN RETURN false; END IF;
  RETURN COALESCE(c->'keys' ? ('techfinance.contaazul_people.view.workspace'), false)
     AND (p_action = 'view' OR COALESCE(c->'keys' ? ('techfinance.contaazul_people.manage.workspace'), false));
END $$;
REVOKE ALL ON FUNCTION public.contaazul_people_access(uuid,uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.contaazul_people_access(uuid,uuid,text) TO authenticated, service_role;

CREATE TABLE public.contaazul_person_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contaazul_id text NOT NULL,
  name text NOT NULL,
  person_kind text NOT NULL CHECK (person_kind IN ('company','person')),
  profile text,
  document text,
  email text,
  local_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  local_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'review' CHECK (status IN ('linked','suggested','review','new','confirmed','ignored')),
  match_by text,
  score numeric(5,4),
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, contaazul_id)
);
CREATE INDEX contaazul_person_links_ws_status_idx ON public.contaazul_person_links (workspace_id, status);
GRANT SELECT ON public.contaazul_person_links TO authenticated;
GRANT ALL ON public.contaazul_person_links TO service_role;
ALTER TABLE public.contaazul_person_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY contaazul_person_links_select ON public.contaazul_person_links FOR SELECT TO authenticated
  USING (public.contaazul_people_access(workspace_id, auth.uid(), 'view'));