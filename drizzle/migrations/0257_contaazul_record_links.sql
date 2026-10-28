CREATE TABLE public.contaazul_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  started_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','rolled_back')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  rolled_back_at timestamptz,
  rolled_back_by uuid
);
CREATE INDEX contaazul_import_runs_ws_idx ON public.contaazul_import_runs (workspace_id, started_at DESC);
GRANT ALL ON public.contaazul_import_runs TO service_role;
ALTER TABLE public.contaazul_import_runs ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.contaazul_import_runs IS 'Execuções da importação completa do Conta Azul (auditoria e desfazer). Lida apenas por server functions autorizadas.';

CREATE TABLE public.contaazul_record_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity text NOT NULL CHECK (entity IN ('receivable','payable','transfer','category','cost_center','bank_account')),
  contaazul_id text NOT NULL,
  local_id uuid,
  local_pair_id uuid,
  status text NOT NULL CHECK (status IN ('matched','imported','review','ignored')),
  tier text,
  decision text CHECK (decision IN ('same','new','ignore')),
  label text,
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  previous jsonb,
  run_id uuid REFERENCES public.contaazul_import_runs(id) ON DELETE SET NULL,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, entity, contaazul_id)
);
CREATE INDEX contaazul_record_links_ws_status_idx ON public.contaazul_record_links (workspace_id, entity, status);
CREATE INDEX contaazul_record_links_run_idx ON public.contaazul_record_links (run_id);
GRANT ALL ON public.contaazul_record_links TO service_role;
ALTER TABLE public.contaazul_record_links ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.contaazul_record_links IS 'Vínculo entre registros do Conta Azul (lançamentos, transferências, categorias, centros, contas) e registros do TechERP. Registros existentes nunca são reescritos; leitura só por server functions autorizadas.';