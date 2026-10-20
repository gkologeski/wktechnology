-- Prova isolada do ciclo 2 do TechProjects (negócio ganho -> projeto de entrega, vínculos e histórico).
-- Roda SOMENTE no banco descartável do harness (estrutura real extraída, sem dados) via
--   bash tests/sql/deal-delivery-isolated.sh drizzle/migrations/0172_*.sql
-- Asserções de acesso rodam como `authenticated` com claims de JWT (nunca service_role).
-- O agendador é chamado como o dono do banco, exatamente como o pg_cron faz.
\set ON_ERROR_STOP 1
\set QUIET 1
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.__isolated_marker WHERE id = 1 AND label = 'techerp-isolated-harness') THEN
    RAISE EXCEPTION 'recusado: banco sem marcador do harness';
  END IF;
END $$;

DROP SCHEMA IF EXISTS t_dd CASCADE;
CREATE SCHEMA t_dd;
GRANT USAGE ON SCHEMA t_dd TO authenticated, anon;
CREATE FUNCTION t_dd.ok(p_name text, p_cond boolean) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p_cond IS DISTINCT FROM true THEN RAISE EXCEPTION 'FALHOU: %', p_name; END IF;
  RAISE NOTICE 'ok: %', p_name; RETURN 'ok';
END $$;
GRANT EXECUTE ON FUNCTION t_dd.ok(text, boolean) TO authenticated, anon;
CREATE FUNCTION t_dd.n_projects(p_deal uuid) RETURNS bigint LANGUAGE sql SECURITY DEFINER AS $$
  SELECT (SELECT count(*) FROM public.projects WHERE deal_id = p_deal)
       + (SELECT count(*) FROM public.project_deal_links WHERE deal_id = p_deal) $$;
GRANT EXECUTE ON FUNCTION t_dd.n_projects(uuid) TO authenticated;

\set A '''aaaaaaaa-0000-4000-8000-00000000000a'''
\set B '''aaaaaaaa-0000-4000-8000-00000000000b'''
\set U1 '''10000000-0000-4000-8000-000000000001'''
\set U2 '''10000000-0000-4000-8000-000000000002'''
\set U3 '''10000000-0000-4000-8000-000000000003'''
\set U4 '''10000000-0000-4000-8000-000000000004'''
\set U5 '''10000000-0000-4000-8000-000000000005'''
\set U6 '''10000000-0000-4000-8000-000000000006'''
\set U7 '''10000000-0000-4000-8000-000000000007'''
\set C1 '''61000000-0000-4000-8000-0000000000c1'''
\set C2 '''61000000-0000-4000-8000-0000000000c2'''
\set CB '''61000000-0000-4000-8000-0000000000cb'''
\set D1 '''52000000-0000-4000-8000-000000000001'''
\set D2 '''52000000-0000-4000-8000-000000000002'''
\set D3 '''52000000-0000-4000-8000-000000000003'''
\set D3B '''52000000-0000-4000-8000-0000000003b0'''
\set D3C '''52000000-0000-4000-8000-0000000003c0'''
\set D4 '''52000000-0000-4000-8000-000000000004'''
\set D5 '''52000000-0000-4000-8000-000000000005'''
\set D6 '''52000000-0000-4000-8000-000000000006'''
\set D7 '''52000000-0000-4000-8000-000000000007'''
\set D8 '''52000000-0000-4000-8000-000000000008'''
\set DB '''52000000-0000-4000-8000-0000000000b1'''
\set DH1 '''51000000-0000-4000-8000-0000000000a1'''
\set DH7 '''51000000-0000-4000-8000-0000000000a7'''
\set PX '''81000000-0000-4000-8000-000000000001'''
\set P7 '''81000000-0000-4000-8000-000000000007'''
\set PC1 '''81000000-0000-4000-8000-0000000000c1'''
\set PB '''81000000-0000-4000-8000-0000000000b1'''
\set K3 '''71000000-0000-4000-8000-000000000003'''
\set K7 '''71000000-0000-4000-8000-000000000007'''

-- ------------------------------------------------------------------ permissões (chaves reais do catálogo)
INSERT INTO public.permission_sets (id, module, name) VALUES
 ('20000000-0000-4000-8000-0000000000d1','techsales','[ISO] Vendas + entrega'),
 ('20000000-0000-4000-8000-0000000000d2','techprojects','[ISO] Técnico projetos') ON CONFLICT DO NOTHING;
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT '20000000-0000-4000-8000-0000000000d1', p.key FROM public.permissions p
 WHERE p.key IN ('techsales.deals.update.workspace','techprojects.projects.create.own','techprojects.projects.update.own',
                 'techprojects.projects.view.own') ON CONFLICT DO NOTHING;
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT '20000000-0000-4000-8000-0000000000d2', p.key FROM public.permissions p
 WHERE p.key IN ('techprojects.projects.view.workspace') ON CONFLICT DO NOTHING;
INSERT INTO public.job_roles (id, name, workspace_id, owner_id) VALUES
 ('30000000-0000-4000-8000-0000000000d1','[ISO] Vendedor com entrega',:A,:A),
 ('30000000-0000-4000-8000-0000000000d2','[ISO] Técnico',:A,:A) ON CONFLICT DO NOTHING;
INSERT INTO public.job_role_sets (role_id, set_id) VALUES
 ('30000000-0000-4000-8000-0000000000d1','20000000-0000-4000-8000-0000000000d1'),
 ('30000000-0000-4000-8000-0000000000d2','20000000-0000-4000-8000-0000000000d2') ON CONFLICT DO NOTHING;
INSERT INTO public.user_job_roles (user_id, owner_id, workspace_id, role_id) VALUES
 (:U4, :A, :A, '30000000-0000-4000-8000-0000000000d1'),
 (:U3, :A, :A, '30000000-0000-4000-8000-0000000000d2');
SELECT t_dd.ok('u4 (vendedor workspace) edita negócios e cria projetos',
  public.user_has_permission(:U4, :A, 'techsales.deals.update.workspace') AND public.user_has_permission(:U4, :A, 'techprojects.projects.create.own'));
SELECT t_dd.ok('u3 (técnico) lê projetos e não edita negócios',
  public.user_has_permission(:U3, :A, 'techprojects.projects.view.workspace') AND NOT public.user_has_permission(:U3, :A, 'techsales.deals.update.workspace'));
SELECT t_dd.ok('u2 (vendedor próprio) sem permissão de projetos', NOT public.user_has_permission(:U2, :A, 'techprojects.projects.create.own'));

-- ------------------------------------------------------------------ fixtures
INSERT INTO public.companies (id, owner_id, name, workspace_id) VALUES
 (:C1, :U1, '[ISO] Cliente Um', :A), (:C2, :U1, '[ISO] Cliente Dois', :A), (:CB, :U6, '[ISO] Cliente B', :B);
INSERT INTO public.pipelines (id, owner_id, workspace_id, entity, name, stages) VALUES
 ('62000000-0000-4000-8000-000000000001', :U1, :A, 'deal', '[ISO] Funil personalizado',
  '[{"value":"aberto","label":"Aberto","type":"open"},{"value":"assinado","label":"Assinado","type":"won"},{"value":"perdeu","label":"Perdeu","type":"lost"}]');
INSERT INTO public.deals (id, workspace_id, owner_id, assigned_to, name, value, stage, company_id) VALUES
 (:D1, :A, :U4, :U4, '[ISO] Venda sem contrato', 777777, 'negotiation', :C1),
 (:D3, :A, :U4, :U4, '[ISO] Venda com contrato', 555555, 'negotiation', :C1),
 (:D3B, :A, :U4, :U4, '[ISO] Contrato de outra empresa', 1, 'negotiation', :C1),
 (:D3C, :A, :U4, :U4, '[ISO] Dois contratos', 1, 'negotiation', :C1),
 (:D4, :A, :U4, :U4, '[ISO] Vários serviços', 1, 'negotiation', :C1),
 (:D5, :A, :U4, :U4, '[ISO] Projeto pré-vinculado', 1, 'negotiation', :C1),
 (:D6, :A, :U4, :U4, '[ISO] Ganho por importação', 1, 'negotiation', :C1),
 (:D8, :A, :U4, :U4, '[ISO] Falha e retry', 1, 'negotiation', :C1),
 (:DB, :B, :U6, :U6, '[ISO] Negócio B', 1, 'negotiation', :CB);
INSERT INTO public.deals (id, workspace_id, owner_id, assigned_to, name, value, stage, stage_id, pipeline_id, company_id) VALUES
 (:D2, :A, :U4, :U4, '[ISO] Etapa personalizada', 1, 'new', 'aberto', '62000000-0000-4000-8000-000000000001', :C2);
INSERT INTO public.contracts (id, workspace_id, owner_id, title, deal_id, counterparty_company_id, document_kind) VALUES
 (:K3, :A, :U1, '[ISO] Contrato D3', :D3, :C1, 'main'),
 ('71000000-0000-4000-8000-0000000003b0', :A, :U1, '[ISO] Contrato de C2', :D3B, :C2, 'main'),
 ('71000000-0000-4000-8000-0000000003c1', :A, :U1, '[ISO] Contrato 1', :D3C, :C1, 'main'),
 ('71000000-0000-4000-8000-0000000003c2', :A, :U1, '[ISO] Contrato 2', :D3C, :C1, 'main'),
 ('71000000-0000-4000-8000-0000000003c3', :A, :U1, '[ISO] Aditivo', :D3C, :C1, 'amendment');
INSERT INTO public.deal_line_items (id, workspace_id, owner_id, deal_id, name, quantity, unit_price, unit, position) VALUES
 ('63000000-0000-4000-8000-000000000031', :A, :U4, :D3, '[ISO] Desenvolvimento', 40, 200, 'hour', 1),
 ('63000000-0000-4000-8000-000000000041', :A, :U4, :D4, '[ISO] App mobile', 5, 100, 'unit', 1),
 ('63000000-0000-4000-8000-000000000042', :A, :U4, :D4, '[ISO] Backend', 10, 100, 'hour', 2),
 ('63000000-0000-4000-8000-000000000043', :A, :U4, :D4, '[ISO] Suporte mensal', 20, 100, 'hour', 3),
 ('63000000-0000-4000-8000-000000000044', :A, :U4, :D4, '[ISO] Taxa de hunting', 1, 900, 'unit', 4);
UPDATE public.deal_line_items SET cadence = 'monthly' WHERE id = '63000000-0000-4000-8000-000000000043';
INSERT INTO public.services (id, workspace_id, owner_id, contract_id, role, name, source_deal_line_item_id) VALUES
 ('64000000-0000-4000-8000-000000000031', :A, :U1, :K3, 'provider', '[ISO] Serviço dev', '63000000-0000-4000-8000-000000000031');
INSERT INTO public.projects (id, workspace_id, owner_id, name, status, company_id) VALUES
 (:PX, :A, :U4, '[ISO] Projeto existente', 'active', :C1),
 (:PB, :B, :U6, '[ISO] Projeto B', 'active', :CB);
INSERT INTO public.project_time_entries (id, workspace_id, project_id, user_id, started_at, stopped_at, hours, entry_date, status, source)
VALUES ('92000000-0000-4000-8000-000000000001', :A, :PX, :U4, '2026-03-01 12:00:00+00', '2026-03-01 13:30:15+00', 1.504, '2026-03-01', 'locked', 'import');

CREATE TABLE t_dd.hash_before AS
SELECT md5(string_agg(concat_ws('|', id, project_id, user_id, started_at, stopped_at, hours, status, source, updated_at), ',' ORDER BY id)) AS entries,
       (SELECT count(*) FROM public.projects) AS projects
  FROM public.project_time_entries;

-- ------------------------------------------------------------------ política: só admin ativo; ativação não reprocessa
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
DO $$ BEGIN
  PERFORM public.deal_delivery_policy_save('aaaaaaaa-0000-4000-8000-00000000000a', true, true, '{"user":true}', '10000000-0000-4000-8000-000000000004', NULL);
  RAISE EXCEPTION 'FALHOU: não-admin ativou a política';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: não-admin não ativa a política'; END $$;
SELECT t_dd.ok('não-admin não lê a política', (SELECT count(*) FROM public.deal_delivery_policies) = 0);
ROLLBACK;

SELECT count(*) AS won_before FROM public.deals WHERE workspace_id = :A AND stage = 'won' \gset
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null
DO $$ BEGIN
  PERFORM public.deal_delivery_policy_save('aaaaaaaa-0000-4000-8000-00000000000a', true, true, '{"user":true}', '10000000-0000-4000-8000-000000000005', NULL);
  RAISE EXCEPTION 'FALHOU: criador inativo aceito';
EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'ok: criador inativo recusado'; END $$;
SELECT public.deal_delivery_policy_save(:A, true, true, '{"user":true,"system":true,"workflow":true,"import":false}', :U7, NULL) AS pol \gset
COMMIT;
SELECT t_dd.ok('política ativa com marco de ativação', (:'pol'::jsonb->'policy'->>'enabled')::boolean AND :'pol'::jsonb->'policy'->>'activated_at' IS NOT NULL);
SELECT t_dd.ok('ativação não criou fila para ganhos antigos', (SELECT count(*) FROM public.deal_delivery_jobs) = 0 AND :won_before >= 2);
SELECT public.deal_delivery_run_jobs(50) \g /dev/null
SELECT t_dd.ok('ativação + agendador não criaram projetos', (SELECT count(*) FROM public.projects) = (SELECT projects FROM t_dd.hash_before));
SELECT t_dd.ok('auditoria da política registrada', (SELECT count(*) FROM public.deal_delivery_events WHERE kind = 'policy_changed') = 1);

-- ------------------------------------------------------------------ venda nova sem contrato (UI como vendedor)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
UPDATE public.deals SET stage = 'won' WHERE id = :D1;
COMMIT;
SELECT t_dd.ok('transição gera 1 evento pendente de origem usuário',
  (SELECT count(*) FROM public.deal_delivery_jobs WHERE deal_id = :D1 AND status = 'pending' AND origin = 'user') = 1);
SELECT t_dd.ok('venda continua ganha antes do processamento', (SELECT stage::text FROM public.deals WHERE id = :D1) = 'won');
SELECT public.deal_delivery_run_jobs(50) AS w1 \gset
SELECT t_dd.ok('agendador concluiu', (:'w1'::jsonb->>'done')::int >= 1);
SELECT t_dd.ok('exatamente 1 projeto em planejamento ligado ao negócio',
  (SELECT count(*) FROM public.projects WHERE deal_id = :D1 AND status = 'planning' AND delivery_group_key = 'default' AND origin = 'deal_auto') = 1);
SELECT t_dd.ok('projeto herda empresa, sem contrato, sem responsável operacional (pendência), dono = criador da política',
  (SELECT company_id = :C1 AND contract_id IS NULL AND assigned_to IS NULL AND owner_id = :U7 FROM public.projects WHERE deal_id = :D1));
SELECT t_dd.ok('vendedor não virou dono nem responsável do projeto',
  NOT EXISTS (SELECT 1 FROM public.projects WHERE deal_id = :D1 AND (owner_id = :U4 OR assigned_to = :U4))
  AND NOT EXISTS (SELECT 1 FROM public.project_members m JOIN public.projects p ON p.id = m.project_id WHERE p.deal_id = :D1));
SELECT t_dd.ok('metadados do projeto sem valor monetário do negócio',
  (SELECT metadata::text NOT LIKE '%777777%' AND metadata::text NOT LIKE '%unit_price%' FROM public.projects WHERE deal_id = :D1));
SELECT public.deal_delivery_run_jobs(50) \g /dev/null
SELECT t_dd.ok('reexecutar o agendador não duplica', t_dd.n_projects(:D1) = 1);
SELECT public.deal_delivery_workflow_ensure(:D1, :A) AS wf1 \gset
SELECT t_dd.ok('ação de workflow reconhece projeto existente', t_dd.n_projects(:D1) = 1
  AND :'wf1'::jsonb->'results'->0->>'action' = 'existing');
DO $$ BEGIN
  PERFORM public.deal_delivery_workflow_ensure('52000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-00000000000b');
  RAISE EXCEPTION 'FALHOU: workflow de outro workspace aceito';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: workflow só no workspace provado'; END $$;

-- leituras recíprocas e escopo
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
SELECT public.deal_delivery_overview(:D1) AS ov \gset
SELECT t_dd.ok('negócio mostra o projeto e pendências (responsável e contrato)',
  jsonb_array_length(:'ov'::jsonb->'projects') = 1
  AND (:'ov'::jsonb->'projects'->0->'pending') ? 'no_operational_owner'
  AND (:'ov'::jsonb->'pending') ? 'no_contract');
SELECT t_dd.ok('leitura do negócio não expõe valor', :'ov'::text NOT LIKE '%777777%');
SELECT (SELECT id FROM public.projects WHERE deal_id = :D1) AS p1 \gset
SELECT t_dd.ok('vendedor com escopo comercial vê a fila do próprio negócio', (SELECT count(*) FROM public.deal_delivery_jobs WHERE deal_id = :D1 AND origin = 'user') = 1);
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', true) \g /dev/null
SELECT public.project_delivery_origin(:'p1') AS po \gset
SELECT t_dd.ok('técnico vê cliente do projeto e negócio oculto sem nome/valor',
  :'po'::jsonb->'company'->>'id' = '61000000-0000-4000-8000-0000000000c1'
  AND (:'po'::jsonb->'deals'->0->>'visible')::boolean = false AND NOT (:'po'::jsonb->'deals'->0 ? 'name')
  AND :'po'::text NOT LIKE '%777777%' AND :'po'::text NOT LIKE '%Venda sem contrato%');
DO $$ BEGIN
  PERFORM public.deal_delivery_overview('52000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'FALHOU: técnico leu entrega de negócio fora do escopo';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: técnico não lê o negócio fora do escopo'; END $$;
SELECT t_dd.ok('técnico não vê a fila do negócio', (SELECT count(*) FROM public.deal_delivery_jobs) = 0);
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null
SELECT public.project_delivery_origin(:'p1') AS po1 \gset
SELECT t_dd.ok('admin vê o negócio de origem no projeto', :'po1'::jsonb->'deals'->0->>'id' = '52000000-0000-4000-8000-000000000001');
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}', true) \g /dev/null
DO $$ BEGIN
  PERFORM public.deal_delivery_overview('52000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'FALHOU: inativo leu';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: inativo sem acesso'; END $$;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}', true) \g /dev/null
DO $$ BEGIN
  PERFORM public.deal_delivery_overview('52000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'FALHOU: outro workspace leu';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: admin de outro workspace sem acesso'; END $$;
SELECT t_dd.ok('outro workspace não vê vínculos/eventos do A',
  (SELECT count(*) FROM public.deal_delivery_events) = 0 AND (SELECT count(*) FROM public.project_deal_links) = 0);
ROLLBACK;
BEGIN;
SET LOCAL ROLE anon;
DO $$ BEGIN
  PERFORM public.deal_delivery_overview('52000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'FALHOU: anônimo executou';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: anônimo sem acesso'; END $$;
ROLLBACK;

-- gravação direta pelo navegador é recusada mesmo para admin
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null
DO $$ BEGIN
  UPDATE public.projects SET deal_id = '52000000-0000-4000-8000-000000000003', delivery_group_key = 'default'
   WHERE id = '81000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'FALHOU: gravação direta do vínculo aceita';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: vínculo direto recusado (só ações de entrega)'; END $$;
ROLLBACK;

-- ------------------------------------------------------------------ reabrir, perder e ganhar de novo
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
UPDATE public.deals SET stage = 'lost' WHERE id = :D1;
COMMIT;
SELECT t_dd.ok('perder não exclui projeto e marca revisão',
  t_dd.n_projects(:D1) = 1 AND (SELECT count(*) FROM public.deal_delivery_events WHERE deal_id = :D1 AND kind = 'review_deal_left_won' AND needs_review) = 1);
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
UPDATE public.deals SET stage = 'won' WHERE id = :D1;
COMMIT;
SELECT public.deal_delivery_run_jobs(50) \g /dev/null
SELECT t_dd.ok('ganhar de novo retoma o mesmo projeto (sem duplicar)',
  t_dd.n_projects(:D1) = 1 AND (SELECT count(*) FROM public.deal_delivery_jobs WHERE deal_id = :D1 AND status = 'done' AND origin = 'user') = 2);
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
UPDATE public.deals SET company_id = :C2 WHERE id = :D1;
COMMIT;
SELECT t_dd.ok('troca de cliente no negócio pede revisão e não altera o projeto',
  (SELECT company_id FROM public.projects WHERE deal_id = :D1) = :C1
  AND (SELECT count(*) FROM public.deal_delivery_events WHERE deal_id = :D1 AND kind = 'review_company_changed' AND needs_review) = 1);

-- ------------------------------------------------------------------ etapa personalizada (tipo "ganho" do funil)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
UPDATE public.deals SET stage_id = 'assinado' WHERE id = :D2;
COMMIT;
SELECT t_dd.ok('etapa personalizada do tipo ganho é reconhecida sem depender de "won"',
  (SELECT stage::text FROM public.deals WHERE id = :D2) = 'new' AND (SELECT count(*) FROM public.deal_delivery_jobs WHERE deal_id = :D2) = 1);
SELECT public.deal_delivery_run_jobs(50) \g /dev/null
SELECT t_dd.ok('projeto criado pela etapa personalizada', t_dd.n_projects(:D2) = 1);

-- ------------------------------------------------------------------ contrato e serviço válidos; incoerentes; ambíguos
UPDATE public.deals SET stage = 'won' WHERE id IN (:D3, :D3B, :D3C);
SELECT public.deal_delivery_run_jobs(50) \g /dev/null
SELECT t_dd.ok('contrato/serviço/item coerentes ligados, horas planejadas do item avulso',
  (SELECT contract_id = :K3 AND service_id = '64000000-0000-4000-8000-000000000031' AND source_line_item_id = '63000000-0000-4000-8000-000000000031'
          AND planned_hours = 40 FROM public.projects WHERE deal_id = :D3));
SELECT t_dd.ok('origem system (sem usuário) registrada', (SELECT origin FROM public.deal_delivery_jobs WHERE deal_id = :D3) = 'system');
SELECT t_dd.ok('contrato de outra empresa não é ligado', (SELECT contract_id IS NULL FROM public.projects WHERE deal_id = :D3B));
SELECT t_dd.ok('dois contratos principais: nenhum escolhido (sem "primeiro contrato")', (SELECT contract_id IS NULL FROM public.projects WHERE deal_id = :D3C));
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
SELECT t_dd.ok('pendências de contrato visíveis no negócio',
  (public.deal_delivery_overview(:D3B)->'pending') ? 'contract_company_mismatch'
  AND (public.deal_delivery_overview(:D3C)->'pending') ? 'contract_ambiguous');
ROLLBACK;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null
DO $$ BEGIN
  UPDATE public.projects SET company_id = '61000000-0000-4000-8000-0000000000c2'
   WHERE deal_id = '52000000-0000-4000-8000-000000000003';
  RAISE EXCEPTION 'FALHOU: cliente incoerente com o contrato aceito';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: cliente do projeto coerente com o contrato'; END $$;
DO $$ BEGIN
  UPDATE public.projects SET contract_id = '71000000-0000-4000-8000-0000000003c1', service_id = '64000000-0000-4000-8000-000000000031'
   WHERE deal_id = '52000000-0000-4000-8000-000000000003';
  RAISE EXCEPTION 'FALHOU: serviço de outro contrato aceito';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: serviço precisa pertencer ao contrato'; END $$;
DO $$ BEGIN
  UPDATE public.projects SET company_id = '61000000-0000-4000-8000-0000000000cb' WHERE id = '81000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'FALHOU: empresa de outro workspace aceita';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: empresa precisa ser do mesmo workspace'; END $$;
ROLLBACK;

-- ------------------------------------------------------------------ vários projetos por grupos explícitos (quantidade não multiplica)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
SELECT public.deal_delivery_set_groups(:D4, '[
  {"line_item_id":"63000000-0000-4000-8000-000000000041","group_key":"dev","group_label":"Desenvolvimento"},
  {"line_item_id":"63000000-0000-4000-8000-000000000042","group_key":"dev","group_label":"Desenvolvimento"},
  {"line_item_id":"63000000-0000-4000-8000-000000000043","group_key":"suporte","group_label":"Suporte"},
  {"line_item_id":"63000000-0000-4000-8000-000000000044","group_key":"none"}]') \g /dev/null
UPDATE public.deals SET stage = 'won' WHERE id = :D4;
COMMIT;
SELECT public.deal_delivery_run_jobs(50) \g /dev/null
SELECT t_dd.ok('2 projetos (dev, suporte); quantidades 5/10/20 não geram N projetos; item "sem entrega" fora',
  t_dd.n_projects(:D4) = 2
  AND (SELECT array_agg(delivery_group_key ORDER BY delivery_group_key) FROM public.projects WHERE deal_id = :D4) = ARRAY['dev','suporte']);
SELECT t_dd.ok('horas planejadas: avulso soma, recorrente fica pendente',
  (SELECT planned_hours FROM public.projects WHERE deal_id = :D4 AND delivery_group_key = 'dev') = 10
  AND (SELECT planned_hours IS NULL FROM public.projects WHERE deal_id = :D4 AND delivery_group_key = 'suporte'));

-- ------------------------------------------------------------------ vincular existente antes do fechamento
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
SELECT public.deal_delivery_link_project(:D5, :PX, 'default', NULL) \g /dev/null
DO $$ BEGIN
  PERFORM public.deal_delivery_link_project('52000000-0000-4000-8000-000000000005', '81000000-0000-4000-8000-0000000000b1', 'default', NULL);
  RAISE EXCEPTION 'FALHOU: projeto de outro workspace vinculado';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: projeto de outro workspace recusado'; END $$;
UPDATE public.deals SET stage = 'won' WHERE id = :D5;
COMMIT;
SELECT public.deal_delivery_run_jobs(50) \g /dev/null
SELECT t_dd.ok('projeto pré-vinculado não duplica no ganho', t_dd.n_projects(:D5) = 1
  AND (SELECT deal_id FROM public.projects WHERE id = :PX) = :D5);
SELECT t_dd.ok('apontamentos do projeto existente intactos',
  (SELECT md5(string_agg(concat_ws('|', id, project_id, user_id, started_at, stopped_at, hours, status, source, updated_at), ',' ORDER BY id))
     FROM public.project_time_entries) = (SELECT entries FROM t_dd.hash_before));

-- vendedor sem permissão de projeto e Ver como
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true) \g /dev/null
DO $$ BEGIN
  PERFORM public.deal_delivery_create_project('51000000-0000-4000-8000-0000000000a1', NULL);
  RAISE EXCEPTION 'FALHOU: vendedor sem permissão criou projeto';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: criar projeto exige permissão de projetos'; END $$;
ROLLBACK;
INSERT INTO public.view_as_sessions (workspace_id, admin_id, target_user_id, mode, nonce, session_id)
VALUES (:A, :U1, :U1, 'role', 'n-iso-dd', 'b0000000-0000-4000-8000-0000000000d1');
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","session_id":"b0000000-0000-4000-8000-0000000000d1"}', true) \g /dev/null
SELECT t_dd.ok('Ver como lê a entrega', jsonb_array_length(public.deal_delivery_overview(:D5)->'projects') = 1);
SELECT t_dd.ok('Ver como: ações aparecem desabilitadas', NOT (public.deal_delivery_overview(:D5)->'can'->>'link')::boolean);
DO $$ BEGIN
  PERFORM public.deal_delivery_unlink_project('52000000-0000-4000-8000-000000000005', '81000000-0000-4000-8000-000000000001', 'teste ver como');
  RAISE EXCEPTION 'FALHOU: Ver como gravou';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: Ver como somente leitura bloqueia vínculo'; END $$;
DO $$ BEGIN
  PERFORM public.deal_delivery_create_project('51000000-0000-4000-8000-0000000000a1', NULL);
  RAISE EXCEPTION 'FALHOU: Ver como criou';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: Ver como somente leitura bloqueia criação'; END $$;
ROLLBACK;
UPDATE public.view_as_sessions SET ended_at = now() WHERE session_id = 'b0000000-0000-4000-8000-0000000000d1';

-- desvincular exige motivo e nunca apaga horas
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
DO $$ BEGIN
  PERFORM public.deal_delivery_unlink_project('52000000-0000-4000-8000-000000000005', '81000000-0000-4000-8000-000000000001', '');
  RAISE EXCEPTION 'FALHOU: desvínculo sem motivo';
EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'ok: desvincular exige motivo'; END $$;
ROLLBACK;

-- ------------------------------------------------------------------ importação / replay: controle de origem
BEGIN;
SELECT set_config('app.deal_origin', 'import', true) \g /dev/null
UPDATE public.deals SET stage = 'won' WHERE id = :D6;
COMMIT;
INSERT INTO public.deals (id, workspace_id, owner_id, name, value, stage, closed_at, company_id, hs_object_id) VALUES
 (:D7, :A, :U4, '[ISO] Ganho antigo importado', 1, 'won', '2020-01-01', :C1, 'hs-iso-7');
SELECT public.deal_delivery_run_jobs(50) \g /dev/null
SELECT t_dd.ok('ganho por importação fica registrado e não cria projeto',
  (SELECT status = 'skipped' AND skip_reason = 'origin_import' FROM public.deal_delivery_jobs WHERE deal_id = :D6) AND t_dd.n_projects(:D6) = 0);
SELECT t_dd.ok('ganho antigo importado (antes da ativação) não cria projeto',
  (SELECT status = 'skipped' AND skip_reason = 'closed_before_activation' FROM public.deal_delivery_jobs WHERE deal_id = :D7) AND t_dd.n_projects(:D7) = 0);
SELECT t_dd.ok('outro workspace sem política: nenhuma fila', NOT EXISTS (SELECT 1 FROM public.deal_delivery_jobs WHERE workspace_id = :B));
UPDATE public.deals SET stage = 'won' WHERE id = :DB;
SELECT t_dd.ok('ganho no workspace B não gera fila nem projeto', NOT EXISTS (SELECT 1 FROM public.deal_delivery_jobs WHERE workspace_id = :B)
  AND t_dd.n_projects(:DB) = 0);

-- ------------------------------------------------------------------ falha do job: venda preservada, pendência, retry recupera
UPDATE public.workspace_members SET status = 'inactive' WHERE workspace_id = :A AND user_id = :U7;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
UPDATE public.deals SET stage = 'won' WHERE id = :D8;
COMMIT;
SELECT public.deal_delivery_run_jobs(50) \g /dev/null
SELECT t_dd.ok('falha registrada com erro, negócio continua ganho, sem projeto',
  (SELECT status = 'failed' AND attempts = 1 AND last_error LIKE '%criador%' FROM public.deal_delivery_jobs WHERE deal_id = :D8)
  AND (SELECT stage::text FROM public.deals WHERE id = :D8) = 'won' AND t_dd.n_projects(:D8) = 0
  AND (SELECT count(*) FROM public.deal_delivery_events WHERE deal_id = :D8 AND kind = 'job_failed') = 1);
SELECT public.deal_delivery_run_jobs(50) \g /dev/null
SELECT t_dd.ok('backoff: não retenta antes da hora', (SELECT attempts FROM public.deal_delivery_jobs WHERE deal_id = :D8) = 1);
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
SELECT t_dd.ok('pendência de falha visível no negócio', (public.deal_delivery_overview(:D8)->'pending') ? 'job_failed');
ROLLBACK;
UPDATE public.workspace_members SET status = 'active' WHERE workspace_id = :A AND user_id = :U7;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
SELECT public.deal_delivery_retry(:D8) AS rt \gset
COMMIT;
SELECT t_dd.ok('reprocessar recupera: 1 projeto', :'rt'::jsonb->>'job_status' = 'done' AND t_dd.n_projects(:D8) = 1);

-- lease expirado é retomado pelo agendador
INSERT INTO public.deals (id, workspace_id, owner_id, name, value, stage, company_id) VALUES
 ('52000000-0000-4000-8000-000000000009', :A, :U4, '[ISO] Lease', 1, 'won', :C1);
UPDATE public.deal_delivery_jobs SET status = 'running', lease_until = now() - interval '1 minute', attempts = 1
 WHERE deal_id = '52000000-0000-4000-8000-000000000009';
SELECT public.deal_delivery_run_jobs(50) \g /dev/null
SELECT t_dd.ok('lease expirado retomado', t_dd.n_projects('52000000-0000-4000-8000-000000000009') = 1);

SELECT 'concurrency-point' AS marker;
