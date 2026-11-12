-- EMPRESA-PROPOSTA: leitura da empresa emissora nos registros de venda (RLS por linha continua valendo)
GRANT SELECT (legal_entity_id) ON TABLE public.deals TO authenticated;
GRANT SELECT (legal_entity_id) ON TABLE public.quotes TO authenticated;
GRANT SELECT (legal_entity_id) ON TABLE public.proposals TO authenticated;
-- Escolha da empresa só na proposta; o gatilho cnpj_active_legal_entity_id recusa empresa inativa ou de outro workspace
GRANT INSERT (legal_entity_id), UPDATE (legal_entity_id) ON TABLE public.proposals TO authenticated;
