-- Busca global: o ILIKE não é leakproof, então sob RLS o Postgres não usa o índice
-- trigram e varre as linhas do workspace (8 s em atividades). Esta função só
-- devolve IDs candidatos dos workspaces do próprio usuário (via índice); o
-- conteúdo é lido depois pela consulta normal, que continua aplicando RLS.
CREATE OR REPLACE FUNCTION public.global_search_candidate_ids(_entity text, _q text, _limit int DEFAULT 60)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p text;
  lim int := least(greatest(coalesce(_limit, 60), 1), 200);
BEGIN
  IF auth.uid() IS NULL OR length(trim(coalesce(_q, ''))) < 2 THEN
    RETURN;
  END IF;
  p := '%' || replace(replace(replace(trim(_q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  IF _entity = 'activity' THEN
    RETURN QUERY SELECT a.id FROM activities a
      WHERE a.subject ILIKE p AND a.workspace_id IN (SELECT current_user_workspaces())
      LIMIT lim;
  ELSIF _entity = 'contact' THEN
    RETURN QUERY SELECT c.id FROM contacts c
      WHERE (c.first_name ILIKE p OR c.last_name ILIKE p OR c.email ILIKE p)
        AND c.workspace_id IN (SELECT current_user_workspaces())
      LIMIT lim;
  ELSIF _entity = 'company' THEN
    RETURN QUERY SELECT c.id FROM companies c
      WHERE (c.name ILIKE p OR c.domain ILIKE p)
        AND c.workspace_id IN (SELECT current_user_workspaces())
      LIMIT lim;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.global_search_candidate_ids(text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.global_search_candidate_ids(text, text, int) TO authenticated;