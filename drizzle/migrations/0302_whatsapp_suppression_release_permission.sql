INSERT INTO public.permissions(key,module,resource,action,scope,label_pt,description,is_system) VALUES
('system.whatsapp_suppressions.manage.workspace','system','whatsapp_suppressions','manage','workspace','Liberar números de WhatsApp bloqueados pela Meta','Permite liberar manualmente um número bloqueado por recusa da Meta (sem WhatsApp ou limite de engajamento). Sem concessão automática.',true)
ON CONFLICT(key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.wa_release_number_suppression(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE ws uuid; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sessão obrigatória.' USING ERRCODE = '42501'; END IF;
  IF public.is_read_only_view() THEN
    RAISE EXCEPTION 'Modo "Ver como" é somente leitura.' USING ERRCODE = '42501';
  END IF;
  SELECT workspace_id INTO ws FROM public.whatsapp_number_suppressions WHERE id = p_id;
  IF ws IS NULL OR NOT public.is_workspace_member(ws, uid)
     OR NOT public.user_has_permission(uid, ws, 'system.whatsapp_suppressions.manage.workspace') THEN
    RAISE EXCEPTION 'Sem permissão para liberar este número.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.whatsapp_number_suppressions
     SET released_at = now(), released_by = uid, error_count = 0, updated_at = now()
   WHERE id = p_id AND released_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.wa_release_number_suppression(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wa_release_number_suppression(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.wa_release_number_suppression(uuid) IS
  'Liberação manual de número bloqueado pela Meta: membro ativo do workspace do bloqueio + system.whatsapp_suppressions.manage.workspace (deny prevalece via user_effective_permissions); recusado em "Ver como".';