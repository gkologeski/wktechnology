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