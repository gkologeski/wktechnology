-- Corrige ambiguidade entre a variável do laço e o apelido de tabela (g) na etapa de aplicação.
CREATE OR REPLACE FUNCTION public.clickup_import_apply_step(p_run uuid, p_limit integer DEFAULT 300)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
DECLARE r clickup_import_runs; gr record; t record; v_space uuid; v_proj uuid; v_list uuid; v_id uuid; v_parent uuid;
  v_ass uuid[]; v_n int:=0; v_rem int; v_lim int := least(greatest(coalesce(p_limit,300),1),1000); pl jsonb;
BEGIN
  SELECT * INTO r FROM clickup_import_runs WHERE id=p_run FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Importação não encontrada.'; END IF;
  PERFORM clickup_import_require(r.workspace_id, 'manage');
  IF r.status NOT IN ('planned','applying') THEN RAISE EXCEPTION 'Esta importação não está pronta para aplicar.'; END IF;
  PERFORM set_config('app.clockify_import','on',true);
  IF r.status='planned' THEN
    UPDATE clickup_import_runs SET status='applying', confirmed_by=auth.uid(), confirmed_at=now(), updated_at=now() WHERE id=p_run;
  END IF;

  FOR gr IN SELECT * FROM clickup_import_groups WHERE run_id=p_run AND action='import' AND erp_list_id IS NULL
           ORDER BY team_name, space_name, folder_name NULLS FIRST, list_name LOOP
    v_space := gr.target_space_id;
    IF v_space IS NULL THEN
      SELECT id INTO v_space FROM project_spaces WHERE workspace_id=r.workspace_id AND archived_at IS NULL
        AND lower(btrim(name))=lower(btrim(gr.new_space_name)) ORDER BY created_at LIMIT 1;
      IF v_space IS NULL THEN
        INSERT INTO project_spaces(workspace_id, name, created_by) VALUES (r.workspace_id, gr.new_space_name, auth.uid())
          RETURNING id INTO v_space;
        INSERT INTO clickup_import_created(run_id, workspace_id, target_table, target_id, label)
          VALUES (p_run, r.workspace_id, 'project_spaces', v_space, gr.new_space_name);
      END IF;
    END IF;
    v_list := NULL; v_proj := NULL;
    SELECT l.target_id, pl2.project_id INTO v_list, v_proj FROM clickup_import_links l
      JOIN project_lists pl2 ON pl2.id=l.target_id
     WHERE l.workspace_id=r.workspace_id AND l.entity_type='list' AND l.external_id=gr.list_ext_id;
    IF v_list IS NULL THEN
      v_proj := gr.target_project_id;
      IF v_proj IS NULL THEN
        SELECT c.target_id INTO v_proj FROM clickup_import_created c JOIN projects p ON p.id=c.target_id
         WHERE c.run_id=p_run AND c.target_table='projects' AND lower(btrim(p.name))=lower(btrim(gr.new_project_name)) LIMIT 1;
      END IF;
      IF v_proj IS NULL THEN
        INSERT INTO projects(workspace_id, owner_id, name, status, metadata)
        VALUES (r.workspace_id, auth.uid(), gr.new_project_name, coalesce(gr.new_project_status,'active'),
          jsonb_build_object('clickup', jsonb_build_object('run_id', p_run, 'team', gr.team_name, 'space', gr.space_name,
            'folder', gr.folder_name)))
        RETURNING id INTO v_proj;
        INSERT INTO clickup_import_created(run_id, workspace_id, target_table, target_id, label)
          VALUES (p_run, r.workspace_id, 'projects', v_proj, gr.new_project_name);
      END IF;
      INSERT INTO project_lists(workspace_id, space_id, project_id, name, created_by)
        VALUES (r.workspace_id, v_space, v_proj, gr.erp_list_name, auth.uid()) RETURNING id INTO v_list;
      INSERT INTO clickup_import_created(run_id, workspace_id, target_table, target_id, label)
        VALUES (p_run, r.workspace_id, 'project_lists', v_list, gr.erp_list_name);
      INSERT INTO clickup_import_links(workspace_id, entity_type, external_id, target_id, created_run_id, meta)
        VALUES (r.workspace_id, 'list', gr.list_ext_id, v_list, p_run,
          jsonb_build_object('team', gr.team_name, 'space', gr.space_name, 'folder', gr.folder_name, 'list', gr.list_name))
      ON CONFLICT (workspace_id, entity_type, external_id) DO UPDATE SET target_id=EXCLUDED.target_id,
        created_run_id=EXCLUDED.created_run_id, meta=EXCLUDED.meta;
    END IF;
    UPDATE clickup_import_groups SET erp_space_id=v_space, erp_project_id=v_proj, erp_list_id=v_list WHERE id=gr.id;
  END LOOP;

  FOR t IN
    SELECT ct.external_id, ct.parent_external_id, ct.payload, gg.erp_project_id, gg.erp_list_id
      FROM clickup_import_tasks ct
      JOIN clickup_import_groups gg ON gg.run_id=ct.run_id AND gg.list_ext_id=ct.list_ext_id
     WHERE ct.run_id=p_run AND gg.action='import' AND gg.erp_list_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM clickup_import_links l WHERE l.workspace_id=r.workspace_id
             AND l.entity_type='task' AND l.external_id=ct.external_id)
       AND (ct.parent_external_id IS NULL
         OR EXISTS (SELECT 1 FROM clickup_import_links l2 WHERE l2.workspace_id=r.workspace_id
             AND l2.entity_type='task' AND l2.external_id=ct.parent_external_id)
         OR NOT EXISTS (SELECT 1 FROM clickup_import_tasks pt JOIN clickup_import_groups pg
             ON pg.run_id=pt.run_id AND pg.list_ext_id=pt.list_ext_id AND pg.action='import'
             WHERE pt.run_id=p_run AND pt.external_id=ct.parent_external_id))
     ORDER BY (ct.parent_external_id IS NOT NULL), ct.external_id
     LIMIT v_lim
  LOOP
    pl := t.payload;
    v_parent := NULL;
    IF t.parent_external_id IS NOT NULL THEN
      SELECT pt.id INTO v_parent FROM clickup_import_links l JOIN project_tasks pt ON pt.id=l.target_id
       WHERE l.workspace_id=r.workspace_id AND l.entity_type='task' AND l.external_id=t.parent_external_id
         AND pt.project_id=t.erp_project_id;
    END IF;
    v_ass := clickup_import_assignees(r.workspace_id, pl);
    INSERT INTO project_tasks(workspace_id, project_id, list_id, parent_task_id, title, description, status, priority,
      due_at, start_at, tags, assignee_id, assignee_ids, created_at, sort_order)
    VALUES (r.workspace_id, t.erp_project_id, t.erp_list_id, v_parent, left(coalesce(nullif(btrim(pl->>'title'),''),'(sem título)'),500),
      nullif(pl->>'description',''), coalesce(nullif(pl->>'status','')::project_task_status,'todo'),
      coalesce(nullif(pl->>'priority','')::project_task_priority,'normal'),
      nullif(pl->>'due_at','')::date, nullif(pl->>'start_at','')::date,
      coalesce(ARRAY(SELECT jsonb_array_elements_text(coalesce(pl->'tags','[]'))),'{}'),
      v_ass[1], v_ass, coalesce(nullif(pl->>'created_at','')::timestamptz, now()), coalesce((pl->>'order')::int,0))
    RETURNING id INTO v_id;
    INSERT INTO clickup_import_links(workspace_id, entity_type, external_id, target_id, created_run_id, meta)
      VALUES (r.workspace_id, 'task', t.external_id, v_id, p_run,
        jsonb_build_object('url', pl->>'url', 'status_name', pl->>'status_name'));
    v_n := v_n+1;
  END LOOP;

  SELECT count(*) INTO v_rem FROM clickup_import_tasks ct
    JOIN clickup_import_groups gg ON gg.run_id=ct.run_id AND gg.list_ext_id=ct.list_ext_id AND gg.action='import'
   WHERE ct.run_id=p_run AND NOT EXISTS (SELECT 1 FROM clickup_import_links l WHERE l.workspace_id=r.workspace_id
           AND l.entity_type='task' AND l.external_id=ct.external_id);
  IF v_n=0 AND v_rem>0 THEN
    RAISE EXCEPTION 'Restam % tarefas que não puderam ser importadas.', v_rem;
  END IF;
  IF v_rem=0 THEN
    UPDATE clickup_import_runs SET status='applied', applied_at=now(), updated_at=now(),
      counts = counts || jsonb_build_object(
        'tasks_created', (SELECT count(*) FROM clickup_import_links WHERE created_run_id=p_run AND entity_type='task'),
        'lists_created', (SELECT count(*) FROM clickup_import_created WHERE run_id=p_run AND target_table='project_lists'),
        'projects_created', (SELECT count(*) FROM clickup_import_created WHERE run_id=p_run AND target_table='projects'),
        'spaces_created', (SELECT count(*) FROM clickup_import_created WHERE run_id=p_run AND target_table='project_spaces'))
    WHERE id=p_run;
  END IF;
  RETURN jsonb_build_object('created', v_n, 'remaining', v_rem, 'done', v_rem=0);
END $$;