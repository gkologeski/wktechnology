-- Revisão manual da fila de telefones (um registro por vez, só administrador
-- ativo do workspace, fora de "Ver como"). Aditivo.

ALTER TABLE public.phone_normalization_items
  ADD COLUMN IF NOT EXISTS review_kind text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;
COMMENT ON COLUMN public.phone_normalization_items.review_kind IS
  'Subtipo para revisão humana (ex.: legacy_mobile_no9 = celular BR antigo sem o 9º dígito, candidato nunca aplicado sem confirmação).';
COMMENT ON COLUMN public.phone_normalization_items.reviewed_by IS
  'Usuário que resolveu o item na revisão manual.';
CREATE INDEX IF NOT EXISTS phone_norm_items_open_kind_idx
  ON public.phone_normalization_items (run_id, review_kind)
  WHERE applied_at IS NULL AND resolved_at IS NULL;

CREATE OR REPLACE FUNCTION public.phone_review_resolve(_item bigint, _action text, _new_value text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  it public.phone_normalization_items%ROWTYPE;
  v_field text;
  v_cur text;
  v_new text;
  v_digits text;
  v_nat text;
  v_run uuid;
  v_cls text;
  v_has_ws boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only_view() THEN
    RAISE EXCEPTION 'Modo "Ver como" é somente leitura.' USING ERRCODE = '42501';
  END IF;
  IF _action NOT IN ('confirm', 'keep', 'clear') THEN
    RAISE EXCEPTION 'Ação inválida.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO it FROM public.phone_normalization_items WHERE id = _item FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (public.is_workspace_member(it.workspace_id, v_uid)
          AND public.is_workspace_admin_v2(it.workspace_id, v_uid)) THEN
    RAISE EXCEPTION 'Só administradores do workspace revisam telefones.' USING ERRCODE = '42501';
  END IF;
  IF it.applied_at IS NOT NULL OR it.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este item já foi resolvido.' USING ERRCODE = '55000';
  END IF;

  v_field := it.table_name || '.' || it.column_name;
  IF v_field NOT IN ('contacts.phone','contacts.mobile_phone','leads.phone','leads.mobile_phone',
                     'companies.phone','people.phone','people.emergency_phone','ats_candidates.phone',
                     'ats_referrals.candidate_phone','bookings.invitee_phone',
                     'prospecting_results.phone','prospecting_results.company_phone','profiles.phone') THEN
    RAISE EXCEPTION 'Campo fora do inventário.' USING ERRCODE = '22023';
  END IF;
  v_has_ws := it.table_name <> 'profiles';

  IF _action = 'confirm' THEN
    -- Só o candidato "celular antigo + 9": +55 DDD 9 XXXXXXXX, e os 10 dígitos
    -- nacionais sem o 9 precisam estar no valor original (com ou sem 55).
    IF it.review_kind IS DISTINCT FROM 'legacy_mobile_no9' THEN
      RAISE EXCEPTION 'Este item não tem sugestão para confirmar.' USING ERRCODE = '22023';
    END IF;
    IF _new_value IS NULL OR _new_value !~ '^\+55[1-9]{2}9[6-9][0-9]{7}$' THEN
      RAISE EXCEPTION 'Sugestão inválida.' USING ERRCODE = '22023';
    END IF;
    v_nat := substr(_new_value, 4, 2) || substr(_new_value, 7);
    v_digits := regexp_replace(coalesce(it.original_value, ''), '[^0-9]', '', 'g');
    IF NOT (v_digits LIKE v_nat || '%' OR v_digits LIKE '55' || v_nat || '%') THEN
      RAISE EXCEPTION 'A sugestão não corresponde ao número gravado.' USING ERRCODE = '22023';
    END IF;
    v_new := _new_value;
    v_cls := 'manual_confirmed';
  ELSIF _action = 'clear' THEN
    v_new := NULL;
    v_cls := 'manual_cleared';
  ELSE
    v_cls := 'manual_kept';
  END IF;

  -- Valor atual precisa ser o original do item (sem sobrescrever edição posterior).
  EXECUTE format('SELECT %I FROM public.%I WHERE id = $1 %s FOR UPDATE',
                 it.column_name, it.table_name, CASE WHEN v_has_ws THEN 'AND workspace_id = $2' ELSE '' END)
     INTO v_cur USING it.row_id, it.workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_cur IS DISTINCT FROM it.original_value THEN
    RAISE EXCEPTION 'O telefone foi alterado depois da revisão; recarregue a fila.' USING ERRCODE = '40001';
  END IF;

  IF _action IN ('confirm', 'clear') THEN
    EXECUTE format('UPDATE public.%I SET %I = $1 WHERE id = $2 %s',
                   it.table_name, it.column_name, CASE WHEN v_has_ws THEN 'AND workspace_id = $3' ELSE '' END)
      USING v_new, it.row_id, it.workspace_id;
  END IF;

  -- Execução filha "revisão manual" (backup e trilha de quem resolveu).
  SELECT id INTO v_run FROM public.phone_normalization_runs
   WHERE workspace_id = it.workspace_id AND parent_run_id = it.run_id AND criteria = 'revisão manual'
   ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF v_run IS NULL THEN
    INSERT INTO public.phone_normalization_runs
      (workspace_id, normalizer_version, mode, status, criteria, parent_run_id, notes, finished_at)
    VALUES (it.workspace_id, 'manual', 'apply', 'done', 'revisão manual', it.run_id,
            'Itens confirmados, mantidos ou apagados um a um por administrador na tela Telefones.', now())
    RETURNING id INTO v_run;
  END IF;

  INSERT INTO public.phone_normalization_items
    (run_id, workspace_id, table_name, row_id, column_name, original_value, proposed_value,
     classification, reason, applied_at, review_kind, reviewed_by)
  VALUES (v_run, it.workspace_id, it.table_name, it.row_id, it.column_name, it.original_value,
          CASE WHEN _action = 'keep' THEN it.original_value ELSE v_new END,
          v_cls, 'revisão manual', CASE WHEN _action = 'keep' THEN NULL ELSE now() END,
          it.review_kind, v_uid)
  ON CONFLICT (run_id, table_name, row_id, column_name) DO UPDATE
    SET original_value = EXCLUDED.original_value, proposed_value = EXCLUDED.proposed_value,
        classification = EXCLUDED.classification, applied_at = EXCLUDED.applied_at,
        rolled_back_at = NULL, reviewed_by = EXCLUDED.reviewed_by;

  UPDATE public.phone_normalization_items
     SET resolved_at = now(), resolved_run_id = v_run, resolution = v_cls, reviewed_by = v_uid
   WHERE id = it.id;

  UPDATE public.phone_normalization_runs r
     SET finished_at = now(),
         counts = jsonb_set(
           jsonb_set(coalesce(r.counts, '{}'::jsonb), '{resolved}',
                     coalesce(r.counts->'resolved', '{}'::jsonb), true),
           ARRAY['resolved', v_field],
           coalesce(r.counts->'resolved'->v_field, '{}'::jsonb)
             || jsonb_build_object(v_cls, coalesce((r.counts->'resolved'->v_field->>v_cls)::int, 0) + 1),
           true)
   WHERE r.id = v_run;

  RETURN jsonb_build_object('action', _action, 'resolution', v_cls, 'run_id', v_run);
END $$;

REVOKE ALL ON FUNCTION public.phone_review_resolve(bigint, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.phone_review_resolve(bigint, text, text) TO authenticated, service_role;