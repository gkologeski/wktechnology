-- Área de Ajuda e Treinamento (Fase 1). Conteúdo global da plataforma, sem workspace_id:
-- leitura por módulo reaproveita a mesma chave que libera o item de menu (min_permission).

CREATE OR REPLACE FUNCTION public.help_is_active_member(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = _user AND p.active_workspace_id IS NOT NULL
       AND public.is_workspace_member(p.active_workspace_id, _user))
$$;

CREATE OR REPLACE FUNCTION public.help_can_edit()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_platform_admin(auth.uid())
    OR (public.help_is_active_member(auth.uid()) AND (
          public.user_has_permission(auth.uid(), 'techservice.kb.manage.workspace')
       OR public.user_has_permission(auth.uid(), 'techservice.kb.update.workspace'))))
$$;

CREATE OR REPLACE FUNCTION public.help_can_read(_module text, _min_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.is_platform_admin(auth.uid()) THEN true
    WHEN _module = 'platform' THEN false
    WHEN NOT public.help_is_active_member(auth.uid()) THEN false
    WHEN _min_permission IS NULL THEN true
    ELSE public.user_has_permission(auth.uid(), _min_permission)
  END
$$;

REVOKE ALL ON FUNCTION public.help_is_active_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.help_can_edit() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.help_can_read(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.help_is_active_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.help_can_edit() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.help_can_read(text, text) TO authenticated, service_role;

CREATE TABLE public.help_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text NOT NULL CHECK (module_key IN ('crm','ats','people','contracts','projects','finance','core','platform')),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  body_md text NOT NULL DEFAULT '',
  article_type text NOT NULL CHECK (article_type IN ('overview','howto','reference','faq','quickstart','troubleshooting')),
  route_pattern text,
  min_permission text,
  audience text NOT NULL DEFAULT 'internal' CHECK (audience IN ('internal','client')),
  sort_order integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  is_published boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('portuguese'::regconfig, coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(body_md,''))
  ) STORED,
  UNIQUE (module_key, slug)
);
CREATE INDEX help_articles_search_idx ON public.help_articles USING gin (search_vector);
CREATE INDEX help_articles_route_idx ON public.help_articles (route_pattern) WHERE route_pattern IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_articles TO authenticated;
GRANT ALL ON public.help_articles TO service_role;
ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY help_articles_select ON public.help_articles FOR SELECT TO authenticated
  USING ((is_published AND audience = 'internal' AND public.help_can_read(module_key, min_permission))
         OR public.help_can_edit());
CREATE POLICY help_articles_insert ON public.help_articles FOR INSERT TO authenticated
  WITH CHECK (public.help_can_edit());
CREATE POLICY help_articles_update ON public.help_articles FOR UPDATE TO authenticated
  USING (public.help_can_edit()) WITH CHECK (public.help_can_edit());
CREATE POLICY help_articles_delete ON public.help_articles FOR DELETE TO authenticated
  USING (public.help_can_edit());

CREATE OR REPLACE FUNCTION public.help_articles_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NOT NULL THEN NEW.updated_by := auth.uid(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER help_articles_touch BEFORE INSERT OR UPDATE ON public.help_articles
  FOR EACH ROW EXECUTE FUNCTION public.help_articles_touch();

CREATE TABLE public.help_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.help_articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  useful boolean NOT NULL,
  comment text CHECK (comment IS NULL OR char_length(comment) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX help_feedback_article_idx ON public.help_feedback (article_id);
GRANT SELECT, INSERT ON public.help_feedback TO authenticated;
GRANT ALL ON public.help_feedback TO service_role;
ALTER TABLE public.help_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY help_feedback_insert_own ON public.help_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.help_articles a WHERE a.id = article_id));
CREATE POLICY help_feedback_select ON public.help_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin(auth.uid()));

CREATE TABLE public.help_route_misses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route text NOT NULL CHECK (char_length(route) <= 300),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX help_route_misses_route_idx ON public.help_route_misses (route);
GRANT SELECT, INSERT ON public.help_route_misses TO authenticated;
GRANT ALL ON public.help_route_misses TO service_role;
ALTER TABLE public.help_route_misses ENABLE ROW LEVEL SECURITY;
CREATE POLICY help_route_misses_insert_own ON public.help_route_misses FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.help_is_active_member(auth.uid()));
CREATE POLICY help_route_misses_select ON public.help_route_misses FOR SELECT TO authenticated
  USING (public.help_can_edit());

-- Busca em português: SECURITY INVOKER, portanto o RLS de help_articles filtra o resultado.
CREATE OR REPLACE FUNCTION public.help_search(_q text, _limit integer DEFAULT 20)
RETURNS TABLE (id uuid, module_key text, slug text, title text, summary text, article_type text, snippet text, rank real)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH q AS (SELECT websearch_to_tsquery('portuguese'::regconfig, left(coalesce(_q,''), 200)) AS tsq)
  SELECT a.id, a.module_key, a.slug, a.title, a.summary, a.article_type,
         ts_headline('portuguese'::regconfig, a.summary || ' ' || a.body_md, q.tsq,
           'StartSel=<<,StopSel=>>,MaxWords=30,MinWords=10,MaxFragments=1') AS snippet,
         ts_rank(a.search_vector, q.tsq) AS rank
    FROM public.help_articles a, q
   WHERE a.is_published AND a.search_vector @@ q.tsq
   ORDER BY rank DESC, a.title
   LIMIT least(greatest(coalesce(_limit, 20), 1), 50)
$$;
REVOKE ALL ON FUNCTION public.help_search(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.help_search(text, integer) TO authenticated, service_role;
