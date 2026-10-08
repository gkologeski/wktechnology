-- Testes de banco dos perfis de vaga. Rodam em transação e terminam em ROLLBACK
-- (nenhum dado persiste). Uso: psql -v ON_ERROR_STOP=1 -f tests/db/role-profiles.sql
\set ON_ERROR_STOP 1
BEGIN;
SET LOCAL client_min_messages = notice;

-- Fixtures isoladas -----------------------------------------------------------
CREATE TEMP TABLE fx(k text PRIMARY KEY, v uuid) ON COMMIT DROP;
GRANT ALL ON fx TO authenticated, service_role;
INSERT INTO fx VALUES
  ('ws', '184b9435-0a9b-4334-9e89-8854dc883f5d'),
  ('admin', 'e7a00fde-0382-4f6d-a81c-b60745a88dbd'),
  ('noperm', 'cba8e2c2-deb9-4df4-b611-89114a5e3576'),
  ('deal', gen_random_uuid()), ('p1', gen_random_uuid()), ('p2', gen_random_uuid()),
  ('ws2', gen_random_uuid()), ('user2', gen_random_uuid());

INSERT INTO public.deals(id, owner_id, workspace_id, name, stage)
SELECT (SELECT v FROM fx WHERE k='deal'), (SELECT v FROM fx WHERE k='admin'), (SELECT v FROM fx WHERE k='ws'), '[TESTE-ROLLBACK] Negócio perfis', 'negotiation';

CREATE OR REPLACE FUNCTION pg_temp.as_user(_u uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _u, 'role', 'authenticated')::text, true);
END $$;
CREATE OR REPLACE FUNCTION pg_temp.fx(_k text) RETURNS uuid LANGUAGE sql AS $$ SELECT v FROM fx WHERE k = _k $$;

-- 1) Dois perfis (2 + 3 posições) no mesmo negócio ---------------------------
SELECT pg_temp.as_user(pg_temp.fx('admin'));
INSERT INTO public.deal_role_profiles(id, workspace_id, deal_id, title, quantity, modality, seniority, created_by, data)
VALUES (pg_temp.fx('p1'), pg_temp.fx('ws'), pg_temp.fx('deal'), 'Delphi Sênior', 2, 'both', 'senior', pg_temp.fx('admin'), '{}'),
       (pg_temp.fx('p2'), pg_temp.fx('ws'), pg_temp.fx('deal'), 'Delphi Pleno', 3, 'outsourcing', 'pleno', pg_temp.fx('admin'), '{}');
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.deal_role_profiles WHERE deal_id = pg_temp.fx('deal')) = 2, '2 perfis';
  ASSERT (SELECT sum(quantity) FROM public.deal_role_profiles WHERE deal_id = pg_temp.fx('deal')) = 5, '5 posições';
  RAISE NOTICE 'OK 1: 2 perfis / 5 posições';
END $$;

-- quantidade zero recusada
DO $$ BEGIN
  BEGIN
    INSERT INTO public.deal_role_profiles(workspace_id, deal_id, title, quantity, created_by) VALUES (pg_temp.fx('ws'), pg_temp.fx('deal'), 'x', 0, pg_temp.fx('admin'));
    RAISE EXCEPTION 'deveria falhar';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 1b: quantidade 0 recusada';
  END;
END $$;

-- comercial interno
INSERT INTO public.deal_role_profile_commercial(profile_id, workspace_id, data)
VALUES (pg_temp.fx('p1'), pg_temp.fx('ws'), '{"outsourcing":{"sale_price":180,"cost":90}}');

-- 2) Aprovação com revisão desatualizada é barrada ---------------------------
DO $$ BEGIN
  BEGIN
    PERFORM public.role_profile_approve(pg_temp.fx('p1'), 999, '{}'::jsonb, NULL);
    RAISE EXCEPTION 'deveria falhar';
  EXCEPTION WHEN serialization_failure THEN RAISE NOTICE 'OK 2: revisão concorrente barrada';
  END;
END $$;

-- 3) Aprovação cria versão imutável com snapshot comercial (admin tem permissão)
DO $$ DECLARE r jsonb; BEGIN
  r := public.role_profile_approve(pg_temp.fx('p1'), 1, '{"title":"Delphi Sênior"}'::jsonb, '{"outsourcing":{"sale_price":180}}'::jsonb);
  ASSERT (r->>'version')::int = 1;
  ASSERT (SELECT status FROM public.deal_role_profiles WHERE id = pg_temp.fx('p1')) = 'approved';
  ASSERT public.role_profile_version_commercial((r->>'version_id')::uuid) IS NOT NULL;
  RAISE NOTICE 'OK 3: aprovado v1';
END $$;
DO $$ BEGIN
  BEGIN
    UPDATE public.deal_role_profile_versions SET snapshot = '{}' WHERE profile_id = pg_temp.fx('p1');
    RAISE EXCEPTION 'deveria falhar';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK 3b: versão imutável para usuários';
  END;
END $$;

-- 4) Encaminhar sem autorização antecipada em negócio não ganho -> bloqueado
DO $$ BEGIN
  BEGIN
    PERFORM public.role_profile_forward(pg_temp.fx('p1'), '{"title":"Delphi Sênior"}'::jsonb, false, NULL);
    RAISE EXCEPTION 'deveria falhar';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'EARLY_REQUIRED%' THEN RAISE; END IF;
    RAISE NOTICE 'OK 4: antecipado exige autorização';
  END;
  BEGIN
    PERFORM public.role_profile_forward(pg_temp.fx('p1'), '{"title":"Delphi Sênior"}'::jsonb, true, 'curto');
    RAISE EXCEPTION 'deveria falhar';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%motivo%' THEN RAISE; END IF;
    RAISE NOTICE 'OK 4b: motivo obrigatório';
  END;
END $$;

-- 5) Encaminhar autorizado 2x = uma requisição só
DO $$ DECLARE a jsonb; b jsonb; BEGIN
  a := public.role_profile_forward(pg_temp.fx('p1'), '{"title":"Delphi Sênior","salary_min":"9000"}'::jsonb, true, 'Cliente aprovou início antecipado por e-mail');
  b := public.role_profile_forward(pg_temp.fx('p1'), '{"title":"Delphi Sênior"}'::jsonb, true, 'Cliente aprovou início antecipado por e-mail');
  ASSERT (a->>'already')::boolean = false AND (b->>'already')::boolean = true;
  ASSERT a->>'ats_job_id' = b->>'ats_job_id';
  ASSERT (SELECT count(*) FROM public.ats_jobs WHERE metadata->>'role_profile_id' = pg_temp.fx('p1')::text) = 1;
  ASSERT (SELECT deal_id FROM public.ats_jobs WHERE id = (a->>'ats_job_id')::uuid) = pg_temp.fx('deal');
  ASSERT (SELECT (metadata->>'quantity')::int FROM public.ats_jobs WHERE id = (a->>'ats_job_id')::uuid) = 2;
  ASSERT (SELECT stage::text FROM public.deals WHERE id = pg_temp.fx('deal')) = 'negotiation', 'fase não muda';
  ASSERT (SELECT early AND early_reason IS NOT NULL AND authorized_by IS NOT NULL FROM public.deal_role_profile_handoffs WHERE profile_id = pg_temp.fx('p1'));
  RAISE NOTICE 'OK 5: idempotente, vínculo negócio/versão/quantidade, fase intacta, auditoria antecipada';
END $$;

-- 6) Sync explícito só depois de nova aprovação
DO $$ BEGIN
  UPDATE public.deal_role_profiles SET status = 'in_validation', quantity = 4, revision = revision + 1 WHERE id = pg_temp.fx('p1');
  BEGIN
    PERFORM public.role_profile_sync_ats(pg_temp.fx('p1'), '{"title":"x"}'::jsonb);
    RAISE EXCEPTION 'deveria falhar';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Aprove%' THEN RAISE; END IF;
  END;
  PERFORM public.role_profile_approve(pg_temp.fx('p1'), (SELECT revision FROM public.deal_role_profiles WHERE id = pg_temp.fx('p1')), '{"title":"Delphi Sênior","quantity":4}'::jsonb, NULL);
  ASSERT (SELECT status FROM public.deal_role_profiles WHERE id = pg_temp.fx('p1')) = 'forwarded';
  ASSERT (SELECT (metadata->>'quantity')::int FROM public.ats_jobs WHERE metadata->>'role_profile_id' = pg_temp.fx('p1')::text) = 2, 'ATS intacto antes do sync';
  PERFORM public.role_profile_sync_ats(pg_temp.fx('p1'), '{"title":"Delphi Sênior"}'::jsonb);
  ASSERT (SELECT (metadata->>'quantity')::int FROM public.ats_jobs WHERE metadata->>'role_profile_id' = pg_temp.fx('p1')::text) = 4;
  ASSERT (SELECT snapshot->>'quantity' FROM public.deal_role_profile_versions WHERE profile_id = pg_temp.fx('p1') AND version = 1) IS NULL, 'v1 imutável';
  RAISE NOTICE 'OK 6: nova versão, ATS só após sync explícito, snapshot antigo preservado';
END $$;

-- 7) Colunas secretas fora do alcance do usuário
DO $$ BEGIN
  BEGIN PERFORM commercial_snapshot FROM public.deal_role_profile_versions LIMIT 1; RAISE EXCEPTION 'deveria falhar';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK 7a: commercial_snapshot inacessível';
  END;
  BEGIN PERFORM token_hash FROM public.deal_role_profile_share_links LIMIT 1; RAISE EXCEPTION 'deveria falhar';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK 7b: token_hash inacessível';
  END;
  BEGIN PERFORM public.role_profile_link_consume('x', false); RAISE EXCEPTION 'deveria falhar';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK 7c: consumo de link só no servidor';
  END;
END $$;

-- 8) Usuário do workspace SEM permissão não vê nem aprova
SELECT pg_temp.as_user(pg_temp.fx('noperm'));
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.deal_role_profiles WHERE deal_id = pg_temp.fx('deal')) = 0, 'sem view';
  ASSERT (SELECT count(*) FROM public.deal_role_profile_commercial) = 0, 'sem comercial';
  BEGIN
    PERFORM public.role_profile_approve(pg_temp.fx('p2'), 1, '{}'::jsonb, NULL);
    RAISE EXCEPTION 'deveria falhar';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK 8: sem permissão — nada visível, aprovação negada';
  END;
END $$;

-- 9) Outro workspace (tenant) não enxerga nada
RESET role;
INSERT INTO public.workspaces(id, name, created_by) VALUES (pg_temp.fx('ws2'), '[TESTE-ROLLBACK] WS2', pg_temp.fx('user2'));
SELECT pg_temp.as_user(pg_temp.fx('user2'));
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.deal_role_profiles) = 0;
  ASSERT (SELECT count(*) FROM public.deal_role_profile_versions) = 0;
  ASSERT (SELECT count(*) FROM public.deal_role_profile_events) = 0;
  BEGIN
    INSERT INTO public.deal_role_profiles(workspace_id, deal_id, title, created_by) VALUES (pg_temp.fx('ws2'), pg_temp.fx('deal'), 'invasão', pg_temp.fx('user2'));
    RAISE EXCEPTION 'deveria falhar';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'OK 9: isolamento entre workspaces';
  END;
END $$;

-- 10) Links: expirado, revogado e limite (servidor)
RESET role;
SET LOCAL role service_role;
INSERT INTO public.deal_role_profile_share_links(profile_id, workspace_id, base_revision, token_hash, allowed_fields, expires_at, revoked_at, max_reads, created_by) VALUES
  (pg_temp.fx('p2'), pg_temp.fx('ws'), 1, 'h-ok', '{role.team}', now() + interval '1 day', NULL, 1, pg_temp.fx('admin')),
  (pg_temp.fx('p2'), pg_temp.fx('ws'), 1, 'h-exp', '{role.team}', now() - interval '1 minute', NULL, 5, pg_temp.fx('admin')),
  (pg_temp.fx('p2'), pg_temp.fx('ws'), 1, 'h-rev', '{role.team}', now() + interval '1 day', now(), 5, pg_temp.fx('admin'));
DO $$ BEGIN
  ASSERT (SELECT reason FROM public.role_profile_link_consume('h-ok', false)) IS NULL;
  ASSERT (SELECT reason FROM public.role_profile_link_consume('h-ok', false)) = 'read_limit';
  ASSERT (SELECT reason FROM public.role_profile_link_consume('h-exp', false)) = 'expired';
  ASSERT (SELECT reason FROM public.role_profile_link_consume('h-rev', false)) = 'revoked';
  ASSERT (SELECT reason FROM public.role_profile_link_consume('nao-existe', false)) = 'not_found';
  RAISE NOTICE 'OK 10: links expirado/revogado/limite/inexistente';
END $$;

ROLLBACK;
