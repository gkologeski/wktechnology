
-- Storage: drop anon policies that only checked "token IS NOT NULL"
DROP POLICY IF EXISTS "ats_async_videos_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "ats_async_videos_anon_select" ON storage.objects;

-- Table: drop anon insert policy with the same weakness
DROP POLICY IF EXISTS ats_avr_public_insert_via_interview ON public.ats_async_video_responses;

-- Revoke anon privileges; public flow uses the token-validating server route + service role
REVOKE SELECT, INSERT ON public.ats_async_video_responses FROM anon;
