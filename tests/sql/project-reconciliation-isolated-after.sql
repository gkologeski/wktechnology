-- Segunda metade da prova isolada do ciclo 1 (após as duas aplicações concorrentes do runner).
\set ON_ERROR_STOP 1
\set QUIET 1
\set A '''aaaaaaaa-0000-4000-8000-00000000000a'''
\set U2 '''10000000-0000-4000-8000-000000000002'''
\set U4 '''10000000-0000-4000-8000-000000000004'''
\set U7 '''10000000-0000-4000-8000-000000000007'''

SELECT t_recon.ok('concorrência: duas aplicações simultâneas gravam o vínculo uma única vez',
  (SELECT count(*) FROM public.project_link_changes WHERE field = 'person_id' AND reverted_at IS NULL) = 6002
  AND (SELECT count(DISTINCT target_id) FROM public.project_link_changes WHERE field = 'person_id' AND reverted_at IS NULL) = 6002);
SELECT t_recon.ok('concorrência: hash intacto', (SELECT md5(string_agg(concat_ws('|', id, entry_date, hours, duration_minutes, started_at, stopped_at, status,
  billable, source, external_id, updated_at, approved_at, locked_at), ',' ORDER BY id)) FROM public.project_time_entries) = (SELECT h FROM t_recon.hash_before));

-- sugestões: dois candidatos do mesmo registro são recusados; confirmar um aplica
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null
DO $$ BEGIN
  PERFORM public.project_link_suggestions_decide('aaaaaaaa-0000-4000-8000-00000000000a',
    ARRAY(SELECT id FROM public.project_link_suggestions WHERE subject_id = '10000000-0000-4000-8000-000000000007'), 'confirm', 'teste');
  RAISE EXCEPTION 'FALHOU: dois candidatos aceitos';
EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'ok: um candidato por registro'; END $$;
SELECT public.project_link_suggestions_decide(:A,
  ARRAY(SELECT id FROM public.project_link_suggestions WHERE subject_id = :U2 AND criterion = 'name_exact'), 'confirm',
  'Mesma pessoa conferida no cadastro') AS cf \gset
COMMIT;
SELECT t_recon.ok('confirmação aplica pessoa do u2 com rastreio', (:'cf'::jsonb->>'rows_linked')::int = 3
  AND (SELECT count(*) FROM public.project_link_changes WHERE criterion = 'confirmed_suggestion') = 3);
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null
SELECT public.project_link_suggestions_decide(:A,
  ARRAY(SELECT id FROM public.project_link_suggestions WHERE subject_id = :U7), 'reject', 'Homônimos') AS rj \gset
COMMIT;
SELECT t_recon.ok('recusa em lote', (:'rj'::jsonb->>'rejected')::int = 2);

-- leituras do administrador: visão geral e conferência mensal (ERP x fonte coletada)
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true) \g /dev/null
SELECT public.project_reconciliation_overview(:A) AS ov \gset
SELECT t_recon.ok('visão geral: ligados do Clockify e segundos', (:'ov'::jsonb->'clockify'->>'linked_entries')::int = 6002
  AND (:'ov'::jsonb->'clockify'->>'erp_seconds')::numeric = (:'ov'::jsonb->'clockify'->>'source_seconds')::numeric);
SELECT t_recon.ok('visão geral: Jibble separado', (:'ov'::jsonb->'jibble'->>'linked_entries')::int = 1);
SELECT t_recon.ok('conferência mensal: diferença zero quando fonte e ERP batem',
  NOT EXISTS (SELECT 1 FROM public.project_reconciliation_breakdown(:A, 'clockify', '2020-01-01', '2026-12-31', 'month') b WHERE b.diff_seconds <> 0)
  AND (SELECT sum(erp_rows) FROM public.project_reconciliation_breakdown(:A, 'clockify', '2020-01-01', '2026-12-31', 'month', NULL, NULL, 500)) = 6000);
SELECT t_recon.ok('conferência por pessoa paginada', (SELECT count(*) FROM public.project_reconciliation_breakdown(:A, 'all', '2020-01-01', '2027-12-31', 'person', NULL, NULL, 1, 0)) = 1
  AND (SELECT max(total_groups) FROM public.project_reconciliation_breakdown(:A, 'all', '2020-01-01', '2027-12-31', 'person', NULL, NULL, 1, 0)) = 2);
ROLLBACK;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}', true) \g /dev/null
DO $$ BEGIN
  PERFORM public.project_reconciliation_overview('aaaaaaaa-0000-4000-8000-00000000000a');
  RAISE EXCEPTION 'FALHOU: não-admin leu a visão geral';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: não-admin não lê a visão geral'; END $$;
DO $$ BEGIN
  PERFORM * FROM public.project_reconciliation_breakdown('aaaaaaaa-0000-4000-8000-00000000000a', 'all', '2020-01-01', '2027-12-31', 'month');
  RAISE EXCEPTION 'FALHOU: não-admin leu a conferência';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: não-admin não lê a conferência'; END $$;
DO $$ BEGIN
  PERFORM public.project_reconciliation_overview_body('aaaaaaaa-0000-4000-8000-00000000000a');
  RAISE EXCEPTION 'FALHOU: corpo interno exposto';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: corpo interno não é executável pelo usuário'; END $$;
DO $$ BEGIN
  PERFORM public.project_links_apply_exact('aaaaaaaa-0000-4000-8000-00000000000a');
  RAISE EXCEPTION 'FALHOU: não-admin vinculou';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: não-admin não vincula'; END $$;
ROLLBACK;

-- bruto do staging intocado
SELECT t_recon.ok('staging bruto intocado (hash)', (SELECT md5(string_agg(concat_ws('|', id, payload_hash, payload::text, status), ',' ORDER BY id)) FROM (
  SELECT id, payload_hash, payload, status FROM public.time_import_staging
  UNION ALL SELECT id, payload_hash, payload, status FROM public.clockify_staging_records) s) = (SELECT raw FROM t_recon.hash_before));
\echo 'FIM: todas as asserções passaram'
