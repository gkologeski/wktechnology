CREATE TABLE public.project_time_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  archived boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual',
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source, external_id)
);
GRANT SELECT ON public.project_time_tags TO authenticated;
GRANT ALL ON public.project_time_tags TO service_role;
ALTER TABLE public.project_time_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membros leem tags" ON public.project_time_tags FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TABLE public.project_time_entry_tags (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  time_entry_id uuid NOT NULL REFERENCES public.project_time_entries(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.project_time_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (time_entry_id, tag_id)
);
CREATE INDEX project_time_entry_tags_tag_idx ON public.project_time_entry_tags(tag_id);
GRANT SELECT ON public.project_time_entry_tags TO authenticated;
GRANT ALL ON public.project_time_entry_tags TO service_role;
ALTER TABLE public.project_time_entry_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membros leem tags de apontamento" ON public.project_time_entry_tags FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Grupos de origem: apenas informativos, NÃO são Times (user_groups) e não mudam escopo de acesso.
CREATE TABLE public.project_people_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, source, external_id)
);
GRANT SELECT ON public.project_people_groups TO authenticated;
GRANT ALL ON public.project_people_groups TO service_role;
ALTER TABLE public.project_people_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membros leem grupos" ON public.project_people_groups FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TABLE public.project_people_group_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.project_people_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT ON public.project_people_group_members TO authenticated;
GRANT ALL ON public.project_people_group_members TO service_role;
ALTER TABLE public.project_people_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membros leem membros de grupos" ON public.project_people_group_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

COMMENT ON TABLE public.project_people_groups IS 'Grupos vindos de importadores (Clockify). Informativos: não concedem acesso nem alteram escopo de Times.';

CREATE OR REPLACE FUNCTION public.clockify_import_catalogs(p_workspace uuid, p_source text, p_owner uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record; v_id uuid; n_tags int := 0; n_links int := 0; n_groups int := 0; n_members int := 0;
  n_companies int := 0; n_projects int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = p_workspace AND user_id = p_owner) THEN
    RAISE EXCEPTION 'Responsável fora do workspace.';
  END IF;
  PERFORM set_config('app.clockify_import', 'on', true);

  -- Tags
  INSERT INTO project_time_tags (workspace_id, name, archived, source, external_id)
  SELECT p_workspace, coalesce(nullif(payload->>'name',''), external_id), coalesce((payload->>'archived')::boolean,false), 'clockify', external_id
    FROM clockify_staging_records WHERE workspace_id = p_workspace AND source_workspace_id = p_source AND entity_type = 'tag'
  ON CONFLICT (workspace_id, source, external_id) DO UPDATE SET name = EXCLUDED.name, archived = EXCLUDED.archived;
  GET DIAGNOSTICS n_tags = ROW_COUNT;

  INSERT INTO project_time_entry_tags (workspace_id, time_entry_id, tag_id)
  SELECT DISTINCT p_workspace, l.target_id, t.id
    FROM clockify_import_links l
    CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(l.meta->'tag_ids','[]'::jsonb)) tid
    JOIN project_time_tags t ON t.workspace_id = p_workspace AND t.source = 'clockify' AND t.external_id = tid
    JOIN project_time_entries e ON e.id = l.target_id AND e.workspace_id = p_workspace
   WHERE l.workspace_id = p_workspace AND l.source_workspace_id = p_source AND l.entity_type = 'time_entry'
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n_links = ROW_COUNT;

  -- Grupos (informativos)
  INSERT INTO project_people_groups (workspace_id, name, source, external_id)
  SELECT p_workspace, coalesce(nullif(payload->>'name',''), external_id), 'clockify', external_id
    FROM clockify_staging_records WHERE workspace_id = p_workspace AND source_workspace_id = p_source AND entity_type = 'group'
  ON CONFLICT (workspace_id, source, external_id) DO UPDATE SET name = EXCLUDED.name;
  GET DIAGNOSTICS n_groups = ROW_COUNT;

  INSERT INTO project_people_group_members (workspace_id, group_id, user_id)
  SELECT DISTINCT p_workspace, g.id, m.target_id
    FROM clockify_staging_records s
    JOIN project_people_groups g ON g.workspace_id = p_workspace AND g.source = 'clockify' AND g.external_id = s.external_id
    CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(s.payload->'userIds','[]'::jsonb)) uid
    JOIN clockify_mappings m ON m.workspace_id = p_workspace AND m.source_workspace_id = p_source
         AND m.entity_type = 'user' AND m.external_id = uid AND m.target_id IS NOT NULL AND m.decision = 'confirmed'
    JOIN workspace_members wm ON wm.workspace_id = p_workspace AND wm.user_id = m.target_id
   WHERE s.workspace_id = p_workspace AND s.source_workspace_id = p_source AND s.entity_type = 'group'
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n_members = ROW_COUNT;

  -- Clientes pendentes SEM nenhuma empresa de nome igual viram empresas novas.
  FOR r IN
    SELECT m.id AS map_id, m.external_id, s.payload
      FROM clockify_mappings m
      JOIN clockify_staging_records s ON s.workspace_id = m.workspace_id AND s.source_workspace_id = m.source_workspace_id
           AND s.entity_type = 'client' AND s.external_id = m.external_id
     WHERE m.workspace_id = p_workspace AND m.source_workspace_id = p_source AND m.entity_type = 'client'
       AND m.decision = 'pending' AND m.target_id IS NULL
       AND jsonb_array_length(coalesce(m.candidates,'[]'::jsonb)) = 0
  LOOP
    INSERT INTO companies (workspace_id, owner_id, name, notes, external_ids)
    VALUES (p_workspace, p_owner, coalesce(nullif(r.payload->>'name',''), r.external_id),
            nullif(r.payload->>'note',''), jsonb_build_object('clockify', r.external_id))
    RETURNING id INTO v_id;
    UPDATE clockify_mappings SET target_id = v_id, method = 'created', decision = 'confirmed', decided_at = now()
     WHERE id = r.map_id;
    INSERT INTO clockify_import_links (workspace_id, source_workspace_id, entity_type, external_id, segment, target_table, target_id, meta)
    VALUES (p_workspace, p_source, 'client', r.external_id, 0, 'companies', v_id, jsonb_build_object('created_by_import', true))
    ON CONFLICT DO NOTHING;
    n_companies := n_companies + 1;
  END LOOP;

  -- Projetos recebem a empresa do cliente confirmado
  UPDATE projects p SET metadata = jsonb_set(coalesce(p.metadata,'{}'::jsonb), '{clockify,company_id}', to_jsonb(m.target_id::text), true)
    FROM clockify_import_links l, clockify_mappings m
   WHERE l.workspace_id = p_workspace AND l.source_workspace_id = p_source AND l.entity_type = 'project'
     AND p.id = l.target_id AND p.workspace_id = p_workspace
     AND m.workspace_id = p_workspace AND m.source_workspace_id = p_source AND m.entity_type = 'client'
     AND m.decision = 'confirmed' AND m.target_id IS NOT NULL
     AND m.external_id = p.metadata->'clockify'->>'client_id'
     AND (p.metadata->'clockify'->>'company_id') IS DISTINCT FROM m.target_id::text;
  GET DIAGNOSTICS n_projects = ROW_COUNT;

  RETURN jsonb_build_object('tags', n_tags, 'tag_links', n_links, 'groups', n_groups, 'group_members', n_members,
                            'companies_created', n_companies, 'projects_linked', n_projects);
END $$;
REVOKE EXECUTE ON FUNCTION public.clockify_import_catalogs(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clockify_import_catalogs(uuid, text, uuid) TO service_role;