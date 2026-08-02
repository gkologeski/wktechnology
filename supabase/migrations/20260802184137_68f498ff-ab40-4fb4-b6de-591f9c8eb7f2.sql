-- landing_pages: remove anon full-row read; public rendering goes through the
-- server function getPublishedBySlug (service role, restricted column projection).
DROP POLICY IF EXISTS "lp_public_read" ON public.landing_pages;
REVOKE SELECT ON public.landing_pages FROM anon;