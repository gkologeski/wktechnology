-- Continuação da prova isolada do ciclo 2: concorrência (executada pelo runner) e histórico.
\set ON_ERROR_STOP 1
\set QUIET 1
\set A '''aaaaaaaa-0000-4000-8000-00000000000a'''
\set U1 '''10000000-0000-4000-8000-000000000001'''
\set U4 '''10000000-0000-4000-8000-000000000004'''
\set C1 '''61000000-0000-4000-8000-0000000000c1'''
\set DH1 '''51000000-0000-4000-8000-0000000000a1'''
\set DH7 '''51000000-0000-4000-8000-0000000000a7'''
\set P7 '''81000000-0000-4000-8000-000000000007'''
\set PC1 '''81000000-0000-4000-8000-0000000000c1'''
\set K7 '''71000000-0000-4000-8000-000000000007'''

SELECT t_dd.ok('concorrência: duas criações + agendador simultâneos = 1 projeto',
  t_dd.n_projects('52000000-0000-4000-8000-000000000011') = 1);
SELECT t_dd.ok('concorrência: duas ações de workflow simultâneas = 1 projeto',
  t_dd.n_projects('52000000-0000-4000-8000-000000000010') = 1);
SELECT t_dd.ok('no máximo um evento aberto por negócio', NOT EXISTS (
  SELECT deal_id FROM public.deal_delivery_jobs WHERE status IN ('pending','running','failed') GROUP BY deal_id HAVING count(*) > 1));

-- ------------------------------------------------------------------ histórico (central, só admin)
INSERT INTO public.contracts (id, workspace_id, owner_id, title, deal_id, document_kind) VALUES
 (:K7, :A, :U1, '[ISO] Contrato histórico', :DH7, 'main');
INSERT INTO public.projects (id, workspace_id, owner_id, name, status, contract_id) VALUES
 (:P7, :A, :U1, '[ISO] Projeto do contrato histórico', 'active', :K7),
 (:PC1, :A, :U1, '[ISO] Projeto do cliente um', 'active', NULL);
UPDATE public.projects SET company_id = :C1 WHERE id = :PC1;
UPDATE public.deals SET company_id = :C1, closed_at = '2026-02-01' WHERE id = :DH1;
INSERT INTO public.project_time_entries (id, workspace_id, project_id, user_id, started_at, stopped_at, hours, entry_date, status, source)
VALUES ('92000000-0000-4000-8000-0000000000c1', :A, :PC1, :U1, '2026-02-10 12:00:00+00', '2026-02-10 14:00:07+00', 2.002, '2026-02-10', 'locked', 'import');
CREATE TABLE t_dd.hist_before AS SELECT md5(string_agg(concat_ws('|', id, project_id, started_at, stopped_at, hours, status, updated_at), ',' ORDER BY id)) AS h
  FROM public.project_time_entries;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
DO $$ BEGIN
  PERFORM public.deal_delivery_history_list('aaaaaaaa-0000-4000-8000-00000000000a');
  RAISE EXCEPTION 'FALHOU: vendedor leu a central';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: central do histórico só para admin'; END $$;
ROLLBACK;

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null
SELECT public.deal_delivery_history_list(:A, 'missing', NULL, NULL, NULL, 1, 50) AS hl \gset
SELECT t_dd.ok('ganhos antigos sem projeto listados com candidatos explicados',
  EXISTS (SELECT 1 FROM jsonb_array_elements(:'hl'::jsonb->'rows') r WHERE r->>'id' = '51000000-0000-4000-8000-0000000000a7'
           AND EXISTS (SELECT 1 FROM jsonb_array_elements(r->'candidates') c WHERE c->>'criterion' = 'contract_fk' AND (c->>'exact')::boolean))
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(:'hl'::jsonb->'rows') r WHERE r->>'id' = '51000000-0000-4000-8000-0000000000a1'
           AND EXISTS (SELECT 1 FROM jsonb_array_elements(r->'candidates') c WHERE c->>'criterion' = 'company_period' AND NOT (c->>'exact')::boolean
                         AND (c->>'logged_seconds')::numeric = 7207)));
SELECT public.deal_delivery_history_apply_exact(:A) AS ex \gset
COMMIT;
SELECT t_dd.ok('vínculo exato por FK aplicado e auditado', (:'ex'::jsonb->>'linked')::int = 1
  AND (SELECT deal_id FROM public.projects WHERE id = :P7) = :DH7
  AND (SELECT count(*) FROM public.deal_delivery_events WHERE kind = 'history_linked' AND project_id = :P7) = 1);
SELECT t_dd.ok('sugestão por empresa/período não é aplicada sozinha', (SELECT deal_id IS NULL FROM public.projects WHERE id = :PC1));

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null
SELECT public.deal_delivery_history_preview(:A, jsonb_build_array(jsonb_build_object('deal_id', :DH1, 'project_id', :PC1))) AS pv \gset
SELECT t_dd.ok('prévia mostra impacto (horas do projeto) e modo principal',
  :'pv'::jsonb->0->>'blocked' IS NULL AND :'pv'::jsonb->0->>'mode' = 'primary' AND (:'pv'::jsonb->0->'warnings') ? 'project_has_hours');
SELECT public.deal_delivery_history_preview(:A, jsonb_build_array(jsonb_build_object('deal_id', :DH1,
  'project_id', (SELECT id FROM public.projects WHERE deal_id = '52000000-0000-4000-8000-000000000002')))) AS pv2 \gset
SELECT t_dd.ok('prévia bloqueia empresa diferente', :'pv2'::jsonb->0->>'blocked' = 'company_mismatch');
DO $$ BEGIN
  PERFORM public.deal_delivery_history_apply('aaaaaaaa-0000-4000-8000-00000000000a',
    '[{"deal_id":"51000000-0000-4000-8000-0000000000a1","project_id":"81000000-0000-4000-8000-0000000000c1","snapshot":"x"}]', 'Vínculo revisado');
  RAISE EXCEPTION 'FALHOU: snapshot divergente aceito';
EXCEPTION WHEN serialization_failure THEN RAISE NOTICE 'ok: lote recusa dados alterados desde a prévia'; END $$;
DO $$ BEGIN
  PERFORM public.deal_delivery_history_apply('aaaaaaaa-0000-4000-8000-00000000000a', '[]', '');
  RAISE EXCEPTION 'FALHOU: lote sem justificativa';
EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'ok: lote exige justificativa'; END $$;
SELECT public.deal_delivery_history_apply(:A, jsonb_build_array(jsonb_build_object('deal_id', :DH1, 'project_id', :PC1,
  'snapshot', :'pv'::jsonb->0->>'snapshot', 'criterion', 'company_period')), 'Revisado com o comercial') AS ap \gset
COMMIT;
SELECT t_dd.ok('lote confirmado liga o par', (:'ap'::jsonb->>'linked')::int = 1 AND (SELECT deal_id FROM public.projects WHERE id = :PC1) = :DH1);

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null
SELECT id AS ev FROM public.deal_delivery_events WHERE kind = 'history_linked' AND project_id = :PC1 \gset
SELECT public.deal_delivery_history_revert(:A, ARRAY[:'ev'::uuid], 'Desfazer teste') AS rv \gset
SELECT public.deal_delivery_history_revert(:A, ARRAY[:'ev'::uuid], 'Desfazer teste') AS rv2 \gset
COMMIT;
SELECT t_dd.ok('reversão desfaz só o vínculo e não repete', (:'rv'::jsonb->>'reverted')::int = 1 AND (:'rv2'::jsonb->>'reverted')::int = 0
  AND (SELECT deal_id IS NULL FROM public.projects WHERE id = :PC1) AND EXISTS (SELECT 1 FROM public.projects WHERE id = :PC1));

BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null
DO $$ BEGIN
  PERFORM public.deal_delivery_history_create('aaaaaaaa-0000-4000-8000-00000000000a',
    ARRAY(SELECT gen_random_uuid() FROM generate_series(1, 26)), 'lote cego');
  RAISE EXCEPTION 'FALHOU: lote cego aceito';
EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'ok: criação em lote limitada (sem lote cego)'; END $$;
SELECT public.deal_delivery_history_create(:A, ARRAY[:DH1::uuid], 'Projeto faltante confirmado') AS hc \gset
COMMIT;
SELECT t_dd.ok('criar projeto faltante explícito: 1 projeto de origem histórico',
  (SELECT count(*) FROM public.projects WHERE deal_id = :DH1 AND origin = 'deal_history' AND status = 'planning') = 1);
SELECT t_dd.ok('apontamentos preservados (hash igual)', (SELECT md5(string_agg(concat_ws('|', id, project_id, started_at, stopped_at, hours, status, updated_at), ',' ORDER BY id))
  FROM public.project_time_entries) = (SELECT h FROM t_dd.hist_before));
SELECT t_dd.ok('nenhum membro/papel concedido por projetos de entrega', NOT EXISTS (
  SELECT 1 FROM public.project_members m JOIN public.projects p ON p.id = m.project_id WHERE p.origin LIKE 'deal_%'));
SELECT t_dd.ok('nenhum projeto apagado', (SELECT count(*) FROM public.projects) >= (SELECT projects FROM t_dd.hash_before));
SELECT 'FIM: todas as asserções passaram' AS fim;
