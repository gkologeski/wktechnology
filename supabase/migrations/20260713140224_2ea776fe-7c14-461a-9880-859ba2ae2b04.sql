CREATE OR REPLACE FUNCTION public.gcal_base_event_id(provider_event_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN provider_event_id IS NULL THEN NULL
    ELSE regexp_replace(provider_event_id, '_\d{8}T\d{6}Z?$', '')
  END;
$$;