-- Asserções executadas como role authenticated com claims sintéticas (banco isolado).
CREATE OR REPLACE FUNCTION public._walk(p_channel text, p_search text, p_size int)
RETURNS TABLE(n_items int, n_distinct int, total bigint, pages int, sorted boolean)
LANGUAGE plpgsql AS $$
DECLARE r jsonb; c jsonb := NULL; ids text[] := '{}'; keys text[] := '{}'; tot bigint; pg int := 0;
BEGIN
  LOOP
    r := public.get_inbox_unified_page(p_channel, p_search,
      (c->>'at')::timestamptz, (c->>'src')::smallint, (c->>'id')::uuid, p_size);
    pg := pg + 1;
    IF tot IS NULL THEN tot := (r->>'total')::bigint; END IF;
    ids := ids || ARRAY(SELECT e->>'id' FROM jsonb_array_elements(r->'items') e);
    keys := keys || ARRAY(SELECT (e->>'sort_at') FROM jsonb_array_elements(r->'items') e);
    EXIT WHEN NOT (r->>'has_more')::boolean OR pg > 100;
    c := r->'next_cursor';
  END LOOP;
  RETURN QUERY SELECT cardinality(ids), (SELECT count(DISTINCT x)::int FROM unnest(ids) x), tot, pg,
    (SELECT bool_and(a >= b) FROM (SELECT k::timestamptz a, lead(k::timestamptz) OVER (ORDER BY o) b
       FROM unnest(keys) WITH ORDINALITY u(k,o)) s WHERE b IS NOT NULL);
END $$;
GRANT EXECUTE ON FUNCTION public._walk(text,text,int) TO authenticated;

CREATE TEMP TABLE results(caso text, ok boolean, detalhe text);
GRANT ALL ON results TO authenticated;

DO $$ DECLARE w record; r jsonb; BEGIN
  -- A1: admin/dono da caixa no workspace A.
  PERFORM set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001', true);
  SET LOCAL ROLE authenticated;
  SELECT * INTO w FROM public._walk('all', NULL, 37);
  INSERT INTO results VALUES ('A1 all: 181+170+160 sem duplicar/perder, ordenado',
    w.n_items = 511 AND w.n_distinct = 511 AND w.total = 511 AND w.sorted, row_to_json(w)::text);
  SELECT * INTO w FROM public._walk('email', NULL, 50);
  INSERT INTO results VALUES ('A1 email >150', w.n_items = 181 AND w.n_distinct = 181, row_to_json(w)::text);
  SELECT * INTO w FROM public._walk('whatsapp', NULL, 50);
  INSERT INTO results VALUES ('A1 whatsapp >150', w.n_items = 170 AND w.n_distinct = 170, row_to_json(w)::text);
  SELECT * INTO w FROM public._walk('chat', NULL, 50);
  INSERT INTO results VALUES ('A1 chat >150', w.n_items = 160 AND w.n_distinct = 160, row_to_json(w)::text);
  r := public.get_inbox_unified_page('all','agulha-unica',NULL,NULL,NULL,10);
  INSERT INTO results VALUES ('A1 busca alcança item 177 (fora da 1a página), não vê tenant B',
    (r->>'total')::int = 1 AND r->'items'->0->>'id' = 'e0000000-0000-0000-0000-000000000177', r::text);
  r := public.get_inbox_unified_page('email','Numero42',NULL,NULL,NULL,10);
  INSERT INTO results VALUES ('A1 busca por nome do contato', (r->>'total')::int = 1, r->>'total');
  r := public.get_inbox_unified_page('email',NULL,NULL,NULL,NULL,1);
  INSERT INTO results VALUES ('A1 último remetente inbound', r->'items'->0->>'last_inbound_from' = 'recente@exemplo.test', r->'items'->0->>'last_inbound_from');
  INSERT INTO results VALUES ('A1 counts exatos independentes da página',
    r->'counts' = '{"email":181,"whatsapp":170,"chat":160}'::jsonb, (r->'counts')::text);
  r := public.get_inbox_unified_page('all','100%_x',NULL,NULL,NULL,10);
  INSERT INTO results VALUES ('curingas %/_ escapados', (r->>'total')::int = 0, r->>'total');
  RESET ROLE;

  -- A2: membro com escopo próprio (rep restricted). Vê conversas do workspace, mas
  -- nomes só dos contatos próprios; não vê mensagens da caixa do A1 (último remetente nulo).
  PERFORM set_config('request.jwt.claim.sub','a2000000-0000-0000-0000-000000000002', true);
  SET LOCAL ROLE authenticated;
  r := public.get_inbox_unified_page('email','Numero41',NULL,NULL,NULL,10);
  INSERT INTO results VALUES ('A2 próprio: busca por nome de contato de outro dono não casa', (r->>'total')::int = 0, r->>'total');
  r := public.get_inbox_unified_page('email','Numero42',NULL,NULL,NULL,10);
  INSERT INTO results VALUES ('A2 próprio: busca por contato próprio casa', (r->>'total')::int = 1, r->>'total');
  INSERT INTO results VALUES ('A2 próprio: último remetente oculto pela RLS de email_messages',
    (r->'items'->0->>'last_inbound_from') IS NULL, coalesce(r->'items'->0->>'last_inbound_from','null'));
  r := public.get_inbox_unified_page('email','Numero41',NULL,NULL,NULL,10);
  RESET ROLE;

  -- A3: membro sem restrição (equipe/workspace).
  PERFORM set_config('request.jwt.claim.sub','a3000000-0000-0000-0000-000000000003', true);
  SET LOCAL ROLE authenticated;
  SELECT * INTO w FROM public._walk('all', NULL, 100);
  INSERT INTO results VALUES ('A3 workspace: mesmas 511 conversas', w.n_distinct = 511 AND w.total = 511, row_to_json(w)::text);
  RESET ROLE;

  -- B1: outro tenant.
  PERFORM set_config('request.jwt.claim.sub','b1000000-0000-0000-0000-000000000001', true);
  SET LOCAL ROLE authenticated;
  r := public.get_inbox_unified_page('all',NULL,NULL,NULL,NULL,100);
  INSERT INTO results VALUES ('B1 tenant cruzado: só 60 próprias', (r->>'total')::int = 60
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'items') e WHERE e->>'id' LIKE 'e0000000%' OR e->>'id' LIKE 'd0000000%'), r->>'total');
  RESET ROLE;

  -- Sem identidade: nada visível.
  PERFORM set_config('request.jwt.claim.sub','', true);
  SET LOCAL ROLE authenticated;
  r := public.get_inbox_unified_page('all',NULL,NULL,NULL,NULL,10);
  INSERT INTO results VALUES ('sem claims: zero', (r->>'total')::int = 0, r->>'total');
  RESET ROLE;
END $$;

SELECT ok, caso, left(detalhe, 120) FROM results;
SELECT CASE WHEN bool_and(ok) THEN 'TODOS OK' ELSE 'FALHOU' END FROM results;
