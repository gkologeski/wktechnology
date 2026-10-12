-- 0123 — Fase 2: pacotes de outro workspace não valem fora dele + baseline WK reaplicável.
-- Resolução efetiva continua: conjuntos + conjuntos extras + grants − denies, só para membro ativo.
-- Defaults dos cargos NÃO entram na resolução (são só preset/restauração). Provada no isolado (38/0).

CREATE OR REPLACE FUNCTION public.user_effective_permissions(_user_id uuid, _workspace_id uuid)
 RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH active_member AS (
    SELECT 1 FROM public.workspace_members wm
     WHERE wm.workspace_id = _workspace_id AND wm.user_id = _user_id AND wm.status = 'active'
  ), ws AS (
    SELECT w.id, w.created_by FROM public.workspaces w WHERE w.id = _workspace_id
  ), base_permissions AS (
    SELECT p.key
      FROM public.permissions p
     WHERE EXISTS (SELECT 1 FROM ws WHERE ws.created_by = _user_id)
        OR EXISTS (
             SELECT 1 FROM public.workspace_members wm
              WHERE wm.workspace_id = _workspace_id AND wm.user_id = _user_id
                AND wm.role IN ('owner','admin') AND wm.status = 'active')
    UNION
    SELECT psi.permission_key AS key
      FROM public.user_job_roles ujr
      JOIN public.job_role_sets jrs ON jrs.role_id = ujr.role_id
      JOIN public.permission_sets ps ON ps.id = jrs.set_id
       AND (ps.workspace_id IS NULL OR ps.workspace_id = _workspace_id)
      JOIN public.permission_set_items psi ON psi.set_id = jrs.set_id
     WHERE ujr.user_id = _user_id
       AND (ujr.owner_id = _workspace_id OR ujr.workspace_id = _workspace_id
            OR ujr.owner_id = (SELECT created_by FROM ws))
    UNION
    SELECT psi.permission_key AS key
      FROM public.user_permission_sets ups
      JOIN public.permission_sets ps ON ps.id = ups.set_id
       AND (ps.workspace_id IS NULL OR ps.workspace_id = _workspace_id)
      JOIN public.permission_set_items psi ON psi.set_id = ups.set_id
     WHERE ups.user_id = _user_id
       AND (ups.owner_id = _workspace_id OR ups.owner_id = (SELECT created_by FROM ws))
  ), role_grants AS (
    SELECT o.permission_key AS key
      FROM public.user_job_roles ujr
      JOIN public.job_role_permission_overrides o ON o.role_id = ujr.role_id
     WHERE ujr.user_id = _user_id
       AND (ujr.owner_id = _workspace_id OR ujr.workspace_id = _workspace_id
            OR ujr.owner_id = (SELECT created_by FROM ws))
       AND o.workspace_id = _workspace_id AND o.effect = 'grant'
  ), denied AS (
    SELECT o.permission_key AS key
      FROM public.user_job_roles ujr
      JOIN public.job_role_permission_overrides o ON o.role_id = ujr.role_id
     WHERE ujr.user_id = _user_id
       AND (ujr.owner_id = _workspace_id OR ujr.workspace_id = _workspace_id
            OR ujr.owner_id = (SELECT created_by FROM ws))
       AND o.workspace_id = _workspace_id AND o.effect = 'deny'
  )
  SELECT DISTINCT key
    FROM (SELECT key FROM base_permissions UNION SELECT key FROM role_grants) effective
   WHERE EXISTS (SELECT 1 FROM active_member)
     AND NOT EXISTS (SELECT 1 FROM denied d WHERE d.key = effective.key)
$function$;

CREATE OR REPLACE FUNCTION public.rbac_wk_apply_baseline_2026_10()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wk constant uuid := '184b9435-0a9b-4334-9e89-8854dc883f5d';
  vis constant uuid := '5ff49619-d951-4f89-a3a5-5327ed17ea54';
  actor uuid; n_grant int; n_deny int; n_bundle int;
  sysres constant text[] := ARRAY['billing','branding','integrations','modules','rbac_diagnostics','hubspot_sync',
    'import','marketplace','audit','widget','portal','workflows','custom_objects','custom_properties','onboarding_templates'];
BEGIN
  SELECT created_by INTO actor FROM public.workspaces WHERE id = wk;
  IF actor IS NULL THEN RAISE EXCEPTION 'Workspace WK ausente'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rbac_wk_backup_2026_10 WHERE workspace_id = wk AND source = 'job_role_permission_overrides')
     AND EXISTS (SELECT 1 FROM public.job_role_permission_overrides WHERE workspace_id = wk) THEN
    RAISE EXCEPTION 'Foto anterior ausente; rode a 0122 primeiro';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _rbac_plan(role_id uuid, key text, effect text, reason text) ON COMMIT DROP;
  TRUNCATE _rbac_plan;

  INSERT INTO _rbac_plan SELECT d.role_id, d.permission_key, 'grant', 'apontador_baseline'
    FROM public.job_role_default_permissions d WHERE d.role_id = 'aaaaaaaa-0000-4000-8000-00000000000b';

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

  INSERT INTO _rbac_plan
  SELECT t.role_id, i.permission_key, 'deny', 'vis_total_' || t.cat
    FROM (VALUES
      ('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'fin'),('aaaaaaaa-0000-4000-8000-000000000002','fin'),
      ('aaaaaaaa-0000-4000-8000-000000000003','fin'),('aaaaaaaa-0000-4000-8000-000000000004','fin'),
      ('aaaaaaaa-0000-4000-8000-00000000000a','fin'),('d50ea875-1d7e-408c-9dba-0795304168e2','fin'),
      ('dfd8a180-c348-4dc1-af0c-0ceeeb83a846','fin'),
      ('aaaaaaaa-0000-4000-8000-000000000001','people'),('aaaaaaaa-0000-4000-8000-00000000000a','people'),
      ('dfd8a180-c348-4dc1-af0c-0ceeeb83a846','people'),
      ('aaaaaaaa-0000-4000-8000-000000000001','sysadm'),('aaaaaaaa-0000-4000-8000-000000000002','sysadm'),
      ('aaaaaaaa-0000-4000-8000-000000000003','sysadm'),('aaaaaaaa-0000-4000-8000-000000000004','sysadm'),
      ('aaaaaaaa-0000-4000-8000-000000000005','sysadm'),('aaaaaaaa-0000-4000-8000-00000000000a','sysadm'),
      ('d50ea875-1d7e-408c-9dba-0795304168e2','sysadm'),('30ffc6e0-30f1-47dd-be44-910a4c7dc68d','sysadm'),
      ('dfd8a180-c348-4dc1-af0c-0ceeeb83a846','sysadm'),
      ('aaaaaaaa-0000-4000-8000-00000000000a','ext')) t(role_id, cat)
    JOIN public.permission_set_items i ON i.set_id = vis
   WHERE ((t.cat = 'fin' AND i.permission_key LIKE 'techfinance.%')
       OR (t.cat = 'people' AND i.permission_key LIKE 'techpeople.%')
       OR (t.cat = 'sysadm' AND split_part(i.permission_key,'.',1) = 'system'
           AND split_part(i.permission_key,'.',3) = 'view' AND split_part(i.permission_key,'.',2) = ANY(sysres))
       OR (t.cat = 'ext' AND (i.permission_key LIKE '%.view.team' OR i.permission_key LIKE '%.view.workspace')))
     AND EXISTS (SELECT 1 FROM public.job_role_sets j WHERE j.role_id = t.role_id AND j.set_id = vis)
     AND NOT EXISTS (
       SELECT 1 FROM public.job_role_sets j
         JOIN public.permission_sets s ON s.id = j.set_id AND (s.workspace_id IS NULL OR s.workspace_id = wk)
         JOIN public.permission_set_items x ON x.set_id = j.set_id
        WHERE j.role_id = t.role_id AND j.set_id <> vis AND x.permission_key = i.permission_key);

  INSERT INTO _rbac_plan SELECT 'a88b68ee-7fc2-427f-ad98-af753fccc552', p.key, 'deny', 'rep_delete_workspace'
    FROM public.permissions p
   WHERE p.key IN ('techsales.activities.delete.workspace','techsales.emails.delete.workspace',
                   'techsales.meetings.delete.workspace','techsales.quotes.delete.workspace',
                   'techsales.tickets.delete.workspace','techsales.whatsapp.delete.workspace',
                   'techsales.inbox.delete.workspace','techsales.inbox.chat.delete.workspace',
                   'techsales.inbox.email.delete.workspace','techsales.inbox.whatsapp.delete.workspace');

  WITH plan AS (
    SELECT DISTINCT ON (p.role_id, p.key) p.* FROM _rbac_plan p
      JOIN public.permissions k ON k.key = p.key
     ORDER BY p.role_id, p.key, (p.effect = 'deny') DESC
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
            jsonb_build_object('grants', n_grant, 'denies', n_deny, 'auditor_bundle_removed', n_bundle, 'version', '2026-10'));
  RETURN jsonb_build_object('grants', n_grant, 'denies', n_deny, 'auditor_bundle_removed', n_bundle);
END $$;
REVOKE ALL ON FUNCTION public.rbac_wk_apply_baseline_2026_10() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rbac_wk_apply_baseline_2026_10() TO service_role;
