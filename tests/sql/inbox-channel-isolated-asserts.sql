CREATE OR REPLACE FUNCTION public._walkc(p_channel text, p_assignee text, p_search text, p_ws uuid, p_size int)
RETURNS TABLE(n_items int, n_distinct int, total bigint, sorted boolean)
LANGUAGE plpgsql AS $$
DECLARE r jsonb; c jsonb := NULL; ids text[] := '{}'; keys text[] := '{}'; tot bigint; pg int := 0;
BEGIN
  LOOP
    r := public.get_inbox_channel_page(p_channel, p_assignee, p_search, p_ws,
      (c->>'at')::timestamptz, (c->>'id')::uuid, p_size);
    pg := pg + 1;
    IF tot IS NULL THEN tot := (r->>'total')::bigint; END IF;
    ids := ids || ARRAY(SELECT e->>'id' FROM jsonb_array_elements(r->'items') e);
    keys := keys || ARRAY(SELECT e->>'sort_at' FROM jsonb_array_elements(r->'items') e);
    EXIT WHEN NOT (r->>'has_more')::boolean OR pg > 100;
    c := r->'next_cursor';
  END LOOP;
  RETURN QUERY SELECT cardinality(ids), (SELECT count(DISTINCT x)::int FROM unnest(ids) x), tot,
    COALESCE((SELECT bool_and(a >= b) FROM (SELECT k::timestamptz a, lead(k::timestamptz) OVER (ORDER BY o) b
       FROM unnest(keys) WITH ORDINALITY u(k,o)) s WHERE b IS NOT NULL), true);
END $$;
GRANT EXECUTE ON FUNCTION public._walkc(text,text,text,uuid,int) TO authenticated;
CREATE TEMP TABLE resc(caso text, ok boolean, detalhe text);
GRANT ALL ON resc TO authenticated;
DO $$ DECLARE w record; r jsonb; BEGIN
  PERFORM set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001', true);
  SET LOCAL ROLE authenticated;
  SELECT * INTO w FROM public._walkc('email','all',NULL,NULL,37);
  INSERT INTO resc VALUES ('email todas 181 (>150, antes cortava em 200 no real) sem dup, ordenado',
    w.n_items=181 AND w.n_distinct=181 AND w.total=181 AND w.sorted, row_to_json(w)::text);
  r := public.get_inbox_channel_page('email','all',NULL,NULL,NULL,NULL,10);
  INSERT INTO resc VALUES ('email contagens exatas todas/minhas/sem dono',
    (r->'counts'->>'all')::int=181 AND (r->'counts'->>'mine')::int + (r->'counts'->>'unassigned')::int < 181
    AND (r->'counts'->>'mine')::int > 0 AND (r->'counts'->>'unassigned')::int > 0, (r->'counts')::text);
  SELECT * INTO w FROM public._walkc('email','mine',NULL,NULL,20);
  INSERT INTO resc VALUES ('email minhas paginado = contagem', w.n_distinct = (r->'counts'->>'mine')::int, row_to_json(w)::text);
  SELECT * INTO w FROM public._walkc('email','unassigned',NULL,NULL,20);
  INSERT INTO resc VALUES ('email sem dono paginado = contagem', w.n_distinct = (r->'counts'->>'unassigned')::int, row_to_json(w)::text);
  INSERT INTO resc VALUES ('email projeção tem campos da tela',
    (r->'items'->0) ?& ARRAY['subject','snippet','message_count','assigned_to','account_id','identity_status','sort_at'], (r->'items'->0)::text);
  r := public.get_inbox_channel_page('email','all','agulha-unica',NULL,NULL,NULL,10);
  INSERT INTO resc VALUES ('email busca acha item fora da 1a página', (r->>'total')::int=1, r->>'total');
  SELECT * INTO w FROM public._walkc('whatsapp','all',NULL,NULL,50);
  INSERT INTO resc VALUES ('whatsapp 170 sem dup', w.n_distinct=170 AND w.total=170 AND w.sorted, row_to_json(w)::text);
  SELECT * INTO w FROM public._walkc('whatsapp','mine',NULL,NULL,50);
  INSERT INTO resc VALUES ('whatsapp minhas 85', w.n_distinct=85, row_to_json(w)::text);
  r := public.get_inbox_channel_page('whatsapp','all','+55000000177',NULL,NULL,NULL,10);
  INSERT INTO resc VALUES ('whatsapp busca por telefone', (r->>'total')::int=0, r->>'total');
  r := public.get_inbox_channel_page('whatsapp','all','0169',NULL,NULL,NULL,10);
  INSERT INTO resc VALUES ('whatsapp busca por trecho do telefone', (r->>'total')::int=1 AND (r->'items'->0) ? 'unread_count', r->>'total');
  SELECT * INTO w FROM public._walkc('chat','all',NULL,'aaaaaaaa-0000-0000-0000-000000000000',50);
  INSERT INTO resc VALUES ('chat 160 do workspace ativo', w.n_distinct=160, row_to_json(w)::text);
  SELECT * INTO w FROM public._walkc('chat','all',NULL,'bbbbbbbb-0000-0000-0000-000000000000',50);
  INSERT INTO resc VALUES ('chat workspace alheio como filtro: 0 (RLS + owner_id)', w.n_distinct=0, row_to_json(w)::text);
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub','a3000000-0000-0000-0000-000000000003', true);
  SET LOCAL ROLE authenticated;
  r := public.get_inbox_channel_page('email','mine',NULL,NULL,NULL,NULL,100);
  INSERT INTO resc VALUES ('minhas depende do usuário (A3 ≠ A1)',
    NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'items') e WHERE e->>'assigned_to' <> 'a3000000-0000-0000-0000-000000000003'), r->>'total');
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub','b1000000-0000-0000-0000-000000000001', true);
  SET LOCAL ROLE authenticated;
  r := public.get_inbox_channel_page('email','all',NULL,NULL,NULL,NULL,100);
  INSERT INTO resc VALUES ('tenant B só vê 30 próprias', (r->>'total')::int=30, r->>'total');
  RESET ROLE;
  BEGIN
    PERFORM public.get_inbox_channel_page('fax','all',NULL,NULL,NULL,NULL,10);
    INSERT INTO resc VALUES ('canal inválido rejeitado', false, 'aceitou');
  EXCEPTION WHEN others THEN INSERT INTO resc VALUES ('canal inválido rejeitado', true, SQLERRM); END;
END $$;
SELECT ok, caso, left(detalhe,100) FROM resc;
SELECT CASE WHEN bool_and(ok) THEN 'TODOS OK' ELSE 'FALHOU' END FROM resc;
