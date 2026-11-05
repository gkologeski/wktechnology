-- Ajuda Fase 3: progresso de leitura das trilhas e tentativas de quiz, sempre do próprio usuário.
CREATE TABLE public.help_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_key text NOT NULL CHECK (module_key IN ('crm','ats','people','contracts','projects','finance','core','platform')),
  slug text NOT NULL CHECK (char_length(slug) <= 120),
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_key, slug)
);
CREATE INDEX help_progress_user_idx ON public.help_progress (user_id, module_key);
GRANT SELECT, INSERT, DELETE ON public.help_progress TO authenticated;
GRANT ALL ON public.help_progress TO service_role;
ALTER TABLE public.help_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY help_progress_select_own ON public.help_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY help_progress_insert_own ON public.help_progress FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.help_is_active_member(auth.uid())
    AND EXISTS (SELECT 1 FROM public.help_articles a
                 WHERE a.module_key = help_progress.module_key AND a.slug = help_progress.slug
                   AND a.is_published AND a.audience = 'internal'
                   AND public.help_can_read(a.module_key, a.min_permission)));
CREATE POLICY help_progress_delete_own ON public.help_progress FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Nota calculada só no servidor: usuários leem as próprias tentativas e nunca gravam direto.
CREATE TABLE public.help_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_key text NOT NULL CHECK (module_key IN ('crm','ats','people','contracts','projects','finance','core','platform')),
  score integer NOT NULL CHECK (score >= 0),
  total integer NOT NULL CHECK (total > 0 AND score <= total),
  passed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX help_quiz_attempts_user_idx ON public.help_quiz_attempts (user_id, module_key);
GRANT SELECT ON public.help_quiz_attempts TO authenticated;
GRANT ALL ON public.help_quiz_attempts TO service_role;
ALTER TABLE public.help_quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY help_quiz_attempts_select_own ON public.help_quiz_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid());