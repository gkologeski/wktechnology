-- Banco DESCARTÁVEL: cursor (created_at, id) do histórico, igual ao filtro
-- `created_at.lt.X,and(created_at.eq.X,id.lt.Y)` do listConversationMessages.
-- 1.200 mensagens, empates em grupos de 4 e microssegundos; percorre até o início
-- e confirma: sem perda, sem repetição, ordem estável; nova mensagem no meio da ida.
CREATE TEMP TABLE m(id uuid PRIMARY KEY, conversation_id uuid, created_at timestamptz);
INSERT INTO m
SELECT gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
       timestamptz '2026-01-01' + (i / 4) * interval '1 second'
         + CASE WHEN i % 8 = 0 THEN interval '0' ELSE interval '1 microsecond' * (i % 3) END
FROM generate_series(1, 1200) i;
CREATE INDEX ON m(conversation_id, created_at DESC);

CREATE OR REPLACE FUNCTION pg_temp.walk(p_size int) RETURNS TABLE(n int, distinct_n int, pages int, ok_order boolean)
LANGUAGE plpgsql AS $$
DECLARE c_at timestamptz; c_id uuid; got uuid[] := '{}'; pg int := 0; r record; cnt int;
BEGIN
  DELETE FROM m WHERE created_at > '2026-06-01'; -- limpa a "nova" da execução anterior
  LOOP
    cnt := 0;
    FOR r IN SELECT id, created_at FROM m
      WHERE conversation_id = '11111111-1111-1111-1111-111111111111'
        AND (c_at IS NULL OR created_at < c_at OR (created_at = c_at AND id < c_id))
      ORDER BY created_at DESC, id DESC LIMIT p_size + 1
    LOOP
      cnt := cnt + 1;
      EXIT WHEN cnt > p_size;
      got := got || r.id; c_at := r.created_at; c_id := r.id;
    END LOOP;
    pg := pg + 1;
    -- nova mensagem chega durante a ida (mais nova que tudo): não pode aparecer nas anteriores
    IF pg = 3 THEN INSERT INTO m VALUES (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', timestamptz '2026-12-01'); END IF;
    EXIT WHEN cnt <= p_size OR pg > 500;
  END LOOP;
  RETURN QUERY SELECT cardinality(got), (SELECT count(DISTINCT x)::int FROM unnest(got) x), pg,
    (SELECT bool_and(o.rn = s.rn) FROM
      (SELECT x, row_number() OVER () rn FROM unnest(got) x) o
      JOIN (SELECT id, row_number() OVER (ORDER BY created_at DESC, id DESC) rn FROM m
            WHERE created_at < '2026-06-01') s ON s.id = o.x);
END $$;

SELECT 'páginas de 50' caso, * FROM pg_temp.walk(50);
SELECT 'páginas de 37' caso, * FROM pg_temp.walk(37);
SELECT CASE WHEN bool_and(n = 1200 AND distinct_n = 1200 AND ok_order) THEN 'TODOS OK' ELSE 'FALHOU' END
FROM (SELECT * FROM pg_temp.walk(50) UNION ALL SELECT * FROM pg_temp.walk(100)) t;
