
CREATE POLICY "contract_imports_own_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'contract-imports' AND owner = auth.uid());

CREATE POLICY "contract_imports_own_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contract-imports' AND owner = auth.uid());

CREATE POLICY "contract_imports_own_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'contract-imports' AND owner = auth.uid());
