CREATE INDEX IF NOT EXISTS idx_contacts_search_trgm
ON public.contacts
USING gin ((COALESCE(email, '') || ' ' || COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) gin_trgm_ops);