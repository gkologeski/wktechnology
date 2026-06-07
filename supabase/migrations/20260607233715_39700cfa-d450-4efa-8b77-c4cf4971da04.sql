CREATE TABLE public.wa_ad_slugs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  phone_number_id TEXT,
  display_phone_number TEXT NOT NULL,
  prefill_message TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  click_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_ad_slugs TO authenticated;
GRANT ALL ON public.wa_ad_slugs TO service_role;

ALTER TABLE public.wa_ad_slugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select_wa_ad_slugs" ON public.wa_ad_slugs FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_insert_wa_ad_slugs" ON public.wa_ad_slugs FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_update_wa_ad_slugs" ON public.wa_ad_slugs FOR UPDATE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "ws_delete_wa_ad_slugs" ON public.wa_ad_slugs FOR DELETE TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TRIGGER update_wa_ad_slugs_updated_at BEFORE UPDATE ON public.wa_ad_slugs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.wa_ad_slug_increment(p_slug TEXT)
RETURNS TABLE(display_phone_number TEXT, prefill_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.wa_ad_slugs s
     SET click_count = s.click_count + 1
   WHERE s.slug = p_slug AND s.is_active = true
  RETURNING s.display_phone_number, s.prefill_message;
END;
$$;

GRANT EXECUTE ON FUNCTION public.wa_ad_slug_increment(TEXT) TO anon, authenticated;