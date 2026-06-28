
ALTER VIEW public.ats_referral_programs_public SET (security_invoker = true);

REVOKE EXECUTE ON FUNCTION public.ensure_silver_medalist_pool(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ats_handle_silver_medalist() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_referral_slug() FROM PUBLIC, anon;
