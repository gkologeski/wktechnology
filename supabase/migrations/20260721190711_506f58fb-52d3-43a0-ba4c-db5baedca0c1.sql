
-- 1) Policies de storage: leitura/escrita restrita ao workspace da pessoa.
-- Convenção de path: {owner_id}/{person_id}/{filename}
DROP POLICY IF EXISTS "people_documents_bucket_select" ON storage.objects;
CREATE POLICY "people_documents_bucket_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'people-documents'
    AND is_workspace_admin_v2(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "people_documents_bucket_insert" ON storage.objects;
CREATE POLICY "people_documents_bucket_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'people-documents'
    AND is_workspace_admin_v2(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "people_documents_bucket_update" ON storage.objects;
CREATE POLICY "people_documents_bucket_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'people-documents'
    AND is_workspace_admin_v2(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
  WITH CHECK (
    bucket_id = 'people-documents'
    AND is_workspace_admin_v2(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "people_documents_bucket_delete" ON storage.objects;
CREATE POLICY "people_documents_bucket_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'people-documents'
    AND is_workspace_admin_v2(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

-- 2) Função que recalcula status a partir do expires_at.
CREATE OR REPLACE FUNCTION public.people_document_derive_status(_expires date)
RETURNS public.people_doc_status
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _expires IS NULL THEN 'valid'::people_doc_status
    WHEN _expires < CURRENT_DATE THEN 'expired'::people_doc_status
    WHEN _expires <= CURRENT_DATE + INTERVAL '30 days' THEN 'expiring'::people_doc_status
    ELSE 'valid'::people_doc_status
  END;
$$;

-- 3) Trigger para manter status coerente ao inserir/atualizar.
CREATE OR REPLACE FUNCTION public.people_documents_sync_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.status := public.people_document_derive_status(NEW.expires_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS people_documents_sync_status_trg ON public.people_documents;
CREATE TRIGGER people_documents_sync_status_trg
  BEFORE INSERT OR UPDATE OF expires_at ON public.people_documents
  FOR EACH ROW EXECUTE FUNCTION public.people_documents_sync_status();

UPDATE public.people_documents
  SET status = public.people_document_derive_status(expires_at)
  WHERE status IS DISTINCT FROM public.people_document_derive_status(expires_at);

-- 4) View de documentos a vencer (para dashboard).
CREATE OR REPLACE VIEW public.people_documents_expiring
WITH (security_invoker = true) AS
SELECT
  d.id,
  d.owner_id,
  d.person_id,
  p.full_name AS person_name,
  p.photo_url AS person_photo_url,
  d.doc_type,
  d.doc_number,
  d.expires_at,
  d.status,
  d.file_url,
  d.file_name,
  d.updated_at,
  (d.expires_at - CURRENT_DATE) AS days_left
FROM public.people_documents d
JOIN public.people p ON p.id = d.person_id
WHERE d.expires_at IS NOT NULL
  AND (d.status IN ('expiring','expired') OR d.expires_at <= CURRENT_DATE + INTERVAL '60 days')
  AND p.archived = false;

GRANT SELECT ON public.people_documents_expiring TO authenticated;
