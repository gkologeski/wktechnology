-- Configuração completa por agente SDR (aditivo). Cada coluna tem default
-- compatível com os agentes existentes: vazio = herdar o comportamento atual.
ALTER TABLE public.sdr_playbooks
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS offer_keys text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS material_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS allowed_tools text[] NOT NULL DEFAULT ARRAY['qualify','material','schedule','handoff']::text[],
  ADD COLUMN IF NOT EXISTS channels text[] NOT NULL DEFAULT ARRAY['whatsapp']::text[],
  ADD COLUMN IF NOT EXISTS guardrails jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS kb_sources jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.sdr_playbooks.assigned_to IS 'Responsável humano do agente (handoff e agenda).';
COMMENT ON COLUMN public.sdr_playbooks.offer_keys IS 'Ofertas do catálogo liberadas para este agente; vazio = todo o catálogo ativo.';
COMMENT ON COLUMN public.sdr_playbooks.material_ids IS 'Materiais liberados para este agente; vazio = todos os aprovados.';
COMMENT ON COLUMN public.sdr_playbooks.allowed_tools IS 'Ferramentas permitidas: qualify, material, schedule, handoff.';
COMMENT ON COLUMN public.sdr_playbooks.channels IS 'Canais suportados pelo agente (hoje whatsapp).';
COMMENT ON COLUMN public.sdr_playbooks.guardrails IS 'Limites do agente: max_questions, no_pricing, extra_rules.';
COMMENT ON COLUMN public.sdr_playbooks.kb_sources IS 'Fontes de conhecimento adicionais (título + url/nota).';
