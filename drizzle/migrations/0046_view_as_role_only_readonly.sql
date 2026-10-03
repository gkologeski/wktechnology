-- O modo pessoa usa a sessão real e as permissões reais do alvo.
-- O modo papel continua bloqueado no banco inclusive para sessões já iniciadas.
UPDATE public.view_as_sessions SET read_only = (mode = 'role') WHERE ended_at IS NULL;
CREATE OR REPLACE FUNCTION public.is_read_only_view()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT EXISTS (
      SELECT 1 FROM public.view_as_sessions v
       WHERE v.session_id = NULLIF(auth.jwt()->>'session_id','')::uuid
         AND v.mode = 'role' AND v.ended_at IS NULL
    )
  ), false);
$$;
