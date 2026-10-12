-- 0127 — Visibilidade total substituída por pacote local por cargo NO workspace (sem deny cruzado).
-- Um deny de cargo vale para todos os cargos da pessoa; por isso os denies de "Visibilidade total"
-- da fase 2 cortavam concessões legítimas de Financeiro/Diretor em pessoas multicargo. Agora o
-- vínculo cargo→conjunto global é trocado, só naquele workspace, por um pacote local recortado.
-- Pacotes/cargos globais e outros workspaces não mudam. Denies anteriores à revisão são preservados.

CREATE TABLE IF NOT EXISTS public.job_role_set_replacements (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.job_roles(id) ON DELETE CASCADE,
  set_id uuid NOT NULL REFERENCES public.permission_sets(id) ON DELETE CASCADE,
  replacement_set_id uuid NOT NULL REFERENCES public.permission_sets(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, role_id, set_id)
);
COMMENT ON TABLE public.job_role_set_replacements IS
  'No workspace indicado, o vínculo cargo→conjunto (set_id) é lido como replacement_set_id (pacote local do mesmo workspace).';

GRANT SELECT ON public.job_role_set_replacements TO authenticated;
GRANT ALL ON public.job_role_set_replacements TO service_role;
ALTER TABLE public.job_role_set_replacements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS jrsr_select_admin ON public.job_role_set_replacements;
CREATE POLICY jrsr_select_admin ON public.job_role_set_replacements FOR SELECT TO authenticated
  USING (public.is_workspace_admin_of(workspace_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.user_effective_permissions(_user_id uuid, _workspace_id uuid)
 RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH active_member AS (
    SELECT 1 FROM public.workspace_members wm
     WHERE wm.workspace_id = _workspace_id AND wm.user_id = _user_id AND wm.status = 'active'
  ), ws AS (
    SELECT w.id, w.created_by FROM public.workspaces w WHERE w.id = _workspace_id
  ), my_roles AS (
    SELECT ujr.role_id
      FROM public.user_job_roles ujr
      LEFT JOIN public.job_roles jr ON jr.id = ujr.role_id
     WHERE ujr.user_id = _user_id
       AND (ujr.workspace_id = _workspace_id OR ujr.owner_id = _workspace_id)
       AND (jr.id IS NULL OR jr.workspace_id IS NULL OR jr.workspace_id = _workspace_id)
  ), my_sets AS (
    SELECT ps.id AS set_id
      FROM public.user_permission_sets ups
      JOIN public.permission_sets ps ON ps.id = ups.set_id
     WHERE ups.user_id = _user_id
       AND (ups.workspace_id = _workspace_id OR ups.owner_id = _workspace_id)
       AND (ps.workspace_id IS NULL OR ps.workspace_id = _workspace_id)
       AND (ps.workspace_id IS NOT NULL OR ps.module <> '__bundle__')
    UNION
    SELECT ps.id
      FROM my_roles r
      JOIN public.job_role_sets jrs ON jrs.role_id = r.role_id
      LEFT JOIN public.job_role_set_replacements rep
        ON rep.workspace_id = _workspace_id AND rep.role_id = r.role_id AND rep.set_id = jrs.set_id
      JOIN public.permission_sets ps ON ps.id = COALESCE(rep.replacement_set_id, jrs.set_id)
     WHERE (ps.workspace_id IS NULL OR ps.workspace_id = _workspace_id)
       AND (ps.workspace_id IS NOT NULL OR ps.module <> '__bundle__')
       AND (rep.replacement_set_id IS NULL OR ps.workspace_id = _workspace_id)
  ), base_permissions AS (
    SELECT p.key FROM public.permissions p
     WHERE EXISTS (SELECT 1 FROM ws WHERE ws.created_by = _user_id)
        OR EXISTS (SELECT 1 FROM public.workspace_members wm
              WHERE wm.workspace_id = _workspace_id AND wm.user_id = _user_id
                AND wm.role IN ('owner','admin') AND wm.status = 'active')
    UNION
    SELECT psi.permission_key FROM my_sets s JOIN public.permission_set_items psi ON psi.set_id = s.set_id
  ), role_grants AS (
    SELECT o.permission_key AS key FROM my_roles r
      JOIN public.job_role_permission_overrides o ON o.role_id = r.role_id
     WHERE o.workspace_id = _workspace_id AND o.effect = 'grant'
  ), denied AS (
    SELECT o.permission_key AS key FROM my_roles r
      JOIN public.job_role_permission_overrides o ON o.role_id = r.role_id
     WHERE o.workspace_id = _workspace_id AND o.effect = 'deny'
  )
  SELECT DISTINCT key
    FROM (SELECT key FROM base_permissions UNION SELECT key FROM role_grants) effective
   WHERE EXISTS (SELECT 1 FROM active_member)
     AND NOT EXISTS (SELECT 1 FROM denied d WHERE d.key = effective.key)
$function$;

CREATE OR REPLACE FUNCTION public.rbac_vis_key_excluded(_key text, _cats text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT ('fin' = ANY(_cats) AND _key LIKE 'techfinance.%')
      OR ('people' = ANY(_cats) AND _key LIKE 'techpeople.%')
      OR ('sysadm' = ANY(_cats) AND split_part(_key,'.',1) = 'system' AND split_part(_key,'.',3) = 'view'
          AND split_part(_key,'.',2) = ANY(ARRAY['billing','branding','integrations','modules','rbac_diagnostics',
            'hubspot_sync','import','marketplace','audit','widget','portal','workflows','custom_objects',
            'custom_properties','onboarding_templates']))
      OR ('ext' = ANY(_cats) AND (_key LIKE '%.view.team' OR _key LIKE '%.view.workspace'))
$$;

CREATE OR REPLACE FUNCTION public.rbac_apply_vis_replacement(_ws uuid, _vis uuid, _spec jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid; e jsonb; v_role uuid; v_cats text[]; v_set uuid;
  n_roles int := 0; n_add int := 0; n_del int := 0; c int;
BEGIN
  SELECT created_by INTO v_owner FROM public.workspaces WHERE id = _ws;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Workspace ausente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.permission_sets WHERE id = _vis AND workspace_id IS NULL) THEN
    RAISE EXCEPTION 'Conjunto global de visibilidade ausente';
  END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(_spec) LOOP
    v_role := (e->>'role')::uuid;
    v_cats := ARRAY(SELECT jsonb_array_elements_text(e->'cats'));
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.job_role_sets WHERE role_id = v_role AND set_id = _vis);
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.job_roles WHERE id = v_role
                               AND (workspace_id IS NULL OR workspace_id = _ws));
    SELECT id INTO v_set FROM public.permission_sets
     WHERE workspace_id = _ws AND module = '__vis_local__' AND name = '__vis_local:' || v_role::text;
    IF v_set IS NULL THEN
      INSERT INTO public.permission_sets(owner_id, workspace_id, module, name, description, is_system)
      VALUES (v_owner, _ws, '__vis_local__', '__vis_local:' || v_role::text,
              'Visibilidade local do cargo neste workspace (substitui a Visibilidade total).', false)
      RETURNING id INTO v_set;
    END IF;
    DELETE FROM public.permission_set_items i
     WHERE i.set_id = v_set
       AND (rbac_vis_key_excluded(i.permission_key, v_cats)
            OR NOT EXISTS (SELECT 1 FROM public.permission_set_items g
                            WHERE g.set_id = _vis AND g.permission_key = i.permission_key));
    GET DIAGNOSTICS c = ROW_COUNT; n_del := n_del + c;
    INSERT INTO public.permission_set_items(set_id, permission_key)
    SELECT v_set, g.permission_key FROM public.permission_set_items g
     WHERE g.set_id = _vis AND NOT rbac_vis_key_excluded(g.permission_key, v_cats)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS c = ROW_COUNT; n_add := n_add + c;
    INSERT INTO public.job_role_set_replacements(workspace_id, role_id, set_id, replacement_set_id, reason)
    VALUES (_ws, v_role, _vis, v_set, 'vis_local:' || array_to_string(v_cats, ','))
    ON CONFLICT (workspace_id, role_id, set_id)
      DO UPDATE SET replacement_set_id = EXCLUDED.replacement_set_id, reason = EXCLUDED.reason;
    n_roles := n_roles + 1;
  END LOOP;
  RETURN jsonb_build_object('roles', n_roles, 'items_added', n_add, 'items_removed', n_del);
END $$;
REVOKE ALL ON FUNCTION public.rbac_apply_vis_replacement(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_apply_vis_replacement(uuid, uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.rbac_wk_apply_baseline_2026_10()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wk constant uuid := '184b9435-0a9b-4334-9e89-8854dc883f5d';
  vis constant uuid := '5ff49619-d951-4f89-a3a5-5327ed17ea54';
  apont constant uuid := 'aaaaaaaa-0000-4000-8000-00000000000b';
  spec constant jsonb := '[
    {"role":"aaaaaaaa-0000-4000-8000-000000000001","cats":["fin","people","sysadm"]},
    {"role":"aaaaaaaa-0000-4000-8000-000000000002","cats":["fin","sysadm"]},
    {"role":"aaaaaaaa-0000-4000-8000-000000000003","cats":["fin","sysadm"]},
    {"role":"aaaaaaaa-0000-4000-8000-000000000004","cats":["fin","sysadm"]},
    {"role":"aaaaaaaa-0000-4000-8000-000000000005","cats":["sysadm"]},
    {"role":"aaaaaaaa-0000-4000-8000-00000000000a","cats":["fin","people","sysadm","ext"]},
    {"role":"d50ea875-1d7e-408c-9dba-0795304168e2","cats":["fin","sysadm"]},
    {"role":"30ffc6e0-30f1-47dd-be44-910a4c7dc68d","cats":["sysadm"]},
    {"role":"dfd8a180-c348-4dc1-af0c-0ceeeb83a846","cats":["fin","people","sysadm"]}]';
  actor uuid; v_set uuid; n_grant int; n_deny int; n_vis_deny int; n_bundle int; rep jsonb;
BEGIN
  SELECT created_by INTO actor FROM public.workspaces WHERE id = wk;
  IF actor IS NULL THEN RAISE EXCEPTION 'Workspace WK ausente'; END IF;

  SELECT s.id INTO v_set FROM public.permission_sets s
   WHERE s.workspace_id = wk AND s.module = '__bundle__' AND s.name = '__role_bundle:' || apont::text LIMIT 1;
  IF v_set IS NULL THEN
    INSERT INTO public.permission_sets(owner_id, workspace_id, module, name, description, is_system)
    VALUES (actor, wk, '__bundle__', '__role_bundle:' || apont::text,
            'Pacote local da WK para o cargo Apontador de Horas.', false) RETURNING id INTO v_set;
  END IF;
  INSERT INTO public.job_role_sets(role_id, set_id) VALUES (apont, v_set) ON CONFLICT DO NOTHING;
  INSERT INTO public.permission_set_items(set_id, permission_key)
  SELECT v_set, d.permission_key FROM public.job_role_default_permissions d WHERE d.role_id = apont
  ON CONFLICT DO NOTHING;

  CREATE TEMP TABLE IF NOT EXISTS _rbac_plan(role_id uuid, key text, effect text, reason text) ON COMMIT DROP;
  TRUNCATE _rbac_plan;
  INSERT INTO _rbac_plan SELECT r::uuid, 'techsales.' || k, 'grant', 'role_profiles' FROM (VALUES
    ('aaaaaaaa-0000-4000-8000-000000000001','role_profiles.view.workspace'),
    ('aaaaaaaa-0000-4000-8000-000000000001','role_profiles.create.workspace'),
    ('aaaaaaaa-0000-4000-8000-000000000001','role_profiles.update.workspace'),
    ('dfd8a180-c348-4dc1-af0c-0ceeeb83a846','role_profiles.view.workspace'),
    ('dfd8a180-c348-4dc1-af0c-0ceeeb83a846','role_profiles.create.workspace'),
    ('dfd8a180-c348-4dc1-af0c-0ceeeb83a846','role_profiles.update.workspace'),
    ('a88b68ee-7fc2-427f-ad98-af753fccc552','role_profiles.view.workspace'),
    ('a88b68ee-7fc2-427f-ad98-af753fccc552','role_profiles.create.workspace'),
    ('a88b68ee-7fc2-427f-ad98-af753fccc552','role_profiles.update.workspace'),
    ('aaaaaaaa-0000-4000-8000-000000000002','role_profiles.view.workspace'),
    ('aaaaaaaa-0000-4000-8000-000000000002','role_profiles.create.workspace'),
    ('aaaaaaaa-0000-4000-8000-000000000002','role_profiles.update.workspace'),
    ('aaaaaaaa-0000-4000-8000-000000000002','role_profiles.manage.workspace'),
    ('aaaaaaaa-0000-4000-8000-000000000002','role_profiles_share.manage.workspace'),
    ('aaaaaaaa-0000-4000-8000-000000000002','role_profiles.approve.workspace'),
    ('aaaaaaaa-0000-4000-8000-000000000006','role_profiles.view.workspace'),
    ('aaaaaaaa-0000-4000-8000-000000000006','role_profiles.manage.workspace'),
    ('aaaaaaaa-0000-4000-8000-000000000006','role_profiles_share.manage.workspace'),
    ('aaaaaaaa-0000-4000-8000-000000000006','role_profiles.approve.workspace'),
    ('d50ea875-1d7e-408c-9dba-0795304168e2','role_profiles.view.workspace'),
    ('d50ea875-1d7e-408c-9dba-0795304168e2','role_profiles.update.workspace'),
    ('d50ea875-1d7e-408c-9dba-0795304168e2','role_profiles.approve.workspace'),
    ('aaaaaaaa-0000-4000-8000-000000000004','role_profiles.view.workspace'),
    ('aaaaaaaa-0000-4000-8000-000000000004','role_profiles.update.workspace'),
    ('aaaaaaaa-0000-4000-8000-000000000004','role_profiles.approve.workspace'),
    ('aaaaaaaa-0000-4000-8000-000000000003','role_profiles.view.workspace'),
    ('aaaaaaaa-0000-4000-8000-000000000003','role_profiles.update.workspace')) v(r, k);
  INSERT INTO _rbac_plan SELECT 'a88b68ee-7fc2-427f-ad98-af753fccc552', p.key, 'deny', 'rep_delete_workspace'
    FROM public.permissions p
   WHERE p.key IN ('techsales.activities.delete.workspace','techsales.emails.delete.workspace',
                   'techsales.meetings.delete.workspace','techsales.quotes.delete.workspace',
                   'techsales.tickets.delete.workspace','techsales.whatsapp.delete.workspace',
                   'techsales.inbox.delete.workspace','techsales.inbox.chat.delete.workspace',
                   'techsales.inbox.email.delete.workspace','techsales.inbox.whatsapp.delete.workspace');
  WITH plan AS (
    SELECT p.* FROM _rbac_plan p JOIN public.permissions k ON k.key = p.key
  ), ins AS (
    INSERT INTO public.job_role_permission_overrides(workspace_id, role_id, permission_key, effect, created_by)
    SELECT wk, role_id, key, effect, actor FROM plan
    ON CONFLICT (workspace_id, role_id, permission_key) DO NOTHING
    RETURNING role_id, permission_key, effect
  ), logged AS (
    INSERT INTO public.rbac_wk_backup_2026_10(workspace_id, source, row_data)
    SELECT wk, 'phase2_added', jsonb_build_object('role_id', i.role_id, 'key', i.permission_key, 'effect', i.effect,
             'reason', (SELECT reason FROM plan WHERE plan.role_id = i.role_id AND plan.key = i.permission_key))
      FROM ins i RETURNING row_data
  )
  SELECT count(*) FILTER (WHERE row_data->>'effect' = 'grant'), count(*) FILTER (WHERE row_data->>'effect' = 'deny')
    INTO n_grant, n_deny FROM logged;

  rep := public.rbac_apply_vis_replacement(wk, vis, spec);

  WITH gone AS (
    DELETE FROM public.job_role_permission_overrides o
     USING public.rbac_wk_backup_2026_10 b
     WHERE o.workspace_id = wk AND o.effect = 'deny'
       AND b.workspace_id = wk AND b.source = 'phase2_added'
       AND b.row_data->>'reason' LIKE 'vis_total_%' AND b.row_data->>'effect' = 'deny'
       AND (b.row_data->>'role_id')::uuid = o.role_id AND b.row_data->>'key' = o.permission_key
       AND NOT EXISTS (SELECT 1 FROM public.rbac_wk_backup_2026_10 s
                        WHERE s.workspace_id = wk AND s.source = 'job_role_permission_overrides'
                          AND s.row_data->>'role_id' = o.role_id::text
                          AND s.row_data->>'permission_key' = o.permission_key
                          AND s.row_data->>'effect' = 'deny')
    RETURNING o.role_id, o.permission_key
  ), logged AS (
    INSERT INTO public.rbac_wk_backup_2026_10(workspace_id, source, row_data)
    SELECT wk, 'phase5_vis_deny_replaced', jsonb_build_object('role_id', role_id, 'key', permission_key) FROM gone
    RETURNING 1
  )
  SELECT count(*) INTO n_vis_deny FROM logged;

  WITH b AS (
    SELECT i.set_id, i.permission_key FROM public.permission_set_items i
      JOIN public.permission_sets s ON s.id = i.set_id
      JOIN public.job_role_sets j ON j.set_id = s.id
     WHERE s.workspace_id = wk AND s.module = '__bundle__' AND j.role_id = 'aaaaaaaa-0000-4000-8000-000000000007'
       AND split_part(i.permission_key,'.',array_length(string_to_array(i.permission_key,'.'),1)-1)
           NOT IN ('view','export')
  ), logged AS (
    INSERT INTO public.rbac_wk_backup_2026_10(workspace_id, source, row_data)
    SELECT wk, 'phase2_removed_bundle_item', jsonb_build_object('set_id', set_id, 'key', permission_key) FROM b
    RETURNING row_data
  ), del AS (
    DELETE FROM public.permission_set_items i USING b
     WHERE i.set_id = b.set_id AND i.permission_key = b.permission_key RETURNING 1
  )
  SELECT count(*) INTO n_bundle FROM del;

  INSERT INTO public.access_audit_log(workspace_id, actor_id, action, entity_type, details)
    VALUES (wk, actor, 'rbac_baseline_applied', 'job_role_permission_overrides',
            jsonb_build_object('grants', n_grant, 'denies', n_deny, 'vis_denies_replaced', n_vis_deny,
                               'vis_local', rep, 'auditor_bundle_removed', n_bundle, 'version', '2026-10b'));
  RETURN jsonb_build_object('grants', n_grant, 'denies', n_deny, 'vis_denies_replaced', n_vis_deny,
                            'vis_local', rep, 'auditor_bundle_removed', n_bundle);
END $$;
REVOKE ALL ON FUNCTION public.rbac_wk_apply_baseline_2026_10() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_wk_apply_baseline_2026_10() TO service_role;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.workspaces WHERE id = '184b9435-0a9b-4334-9e89-8854dc883f5d') THEN
    PERFORM public.rbac_wk_apply_baseline_2026_10();
  END IF;
END $$;