
-- Folders
CREATE TABLE public.user_file_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.user_file_folders(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_file_folders_owner_idx ON public.user_file_folders(owner_id, parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_file_folders TO authenticated;
GRANT ALL ON public.user_file_folders TO service_role;
ALTER TABLE public.user_file_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_file_folders_owner_all"
  ON public.user_file_folders FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Files
CREATE TABLE public.user_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.user_file_folders(id) ON DELETE SET NULL,
  name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  mime_type text,
  is_public boolean NOT NULL DEFAULT false,
  public_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_files_owner_idx ON public.user_files(owner_id, folder_id);
CREATE INDEX user_files_public_token_idx ON public.user_files(public_token) WHERE public_token IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_files TO authenticated;
GRANT ALL ON public.user_files TO service_role;
ALTER TABLE public.user_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_files_owner_all"
  ON public.user_files FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Update trigger
CREATE OR REPLACE FUNCTION public.user_files_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER user_files_updated_at BEFORE UPDATE ON public.user_files
  FOR EACH ROW EXECUTE FUNCTION public.user_files_touch_updated_at();
CREATE TRIGGER user_file_folders_updated_at BEFORE UPDATE ON public.user_file_folders
  FOR EACH ROW EXECUTE FUNCTION public.user_files_touch_updated_at();

-- Quota (100 MB)
CREATE OR REPLACE FUNCTION public.user_files_used_bytes(uid uuid)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(size_bytes), 0)::bigint FROM public.user_files WHERE owner_id = uid;
$$;
GRANT EXECUTE ON FUNCTION public.user_files_used_bytes(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.user_files_enforce_quota()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE used bigint; quota bigint := 100 * 1024 * 1024;
BEGIN
  SELECT COALESCE(SUM(size_bytes), 0) INTO used FROM public.user_files WHERE owner_id = NEW.owner_id;
  IF used + NEW.size_bytes > quota THEN
    RAISE EXCEPTION 'Cota de 100 MB excedida (uso atual: % bytes)', used USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER user_files_quota BEFORE INSERT ON public.user_files
  FOR EACH ROW EXECUTE FUNCTION public.user_files_enforce_quota();

-- Storage policies: user only accesses <auth.uid()>/... in bucket user-files
CREATE POLICY "user_files_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "user_files_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "user_files_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "user_files_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'user-files' AND (storage.foldername(name))[1] = auth.uid()::text);
