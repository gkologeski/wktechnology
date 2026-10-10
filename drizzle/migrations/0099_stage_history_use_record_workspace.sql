-- Gatilhos de etapa e de histórico passam a gravar o workspace do próprio registro.
-- Antes, o INSERT omitia workspace_id e caía no DEFAULT fixo da coluna (tenant original):
-- em qualquer outro workspace a criação/edição de lead/negócio falhava (42501) ou o histórico
-- ia para o tenant errado. Mudança compatível: para o tenant atual o valor é o mesmo.
CREATE OR REPLACE FUNCTION public.track_stage_entries()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_entity text := tg_argv[0];
  v_new_stage text;
  v_old_stage text;
  v_sla numeric;
begin
  if v_entity = 'leads' then
    v_new_stage := coalesce(new.stage_id, new.status::text);
    if tg_op = 'UPDATE' then
      v_old_stage := coalesce(old.stage_id, old.status::text);
    end if;
  else
    v_new_stage := coalesce(new.stage_id, new.stage::text);
    if tg_op = 'UPDATE' then
      v_old_stage := coalesce(old.stage_id, old.stage::text);
    end if;
  end if;

  if tg_op = 'UPDATE' and v_new_stage is not distinct from v_old_stage then
    return null;
  end if;

  -- fecha entrada aberta
  update public.stage_entries
     set exited_at = now()
   where owner_id = new.owner_id
     and entity = v_entity
     and entity_id = new.id
     and exited_at is null;

  -- abre nova entrada
  if v_new_stage is not null then
    v_sla := public.lookup_stage_sla(new.owner_id, v_entity, new.pipeline_id, v_new_stage);
    insert into public.stage_entries (owner_id, entity, entity_id, pipeline_id, stage_id, sla_hours, workspace_id)
    values (new.owner_id, v_entity, new.id, new.pipeline_id, v_new_stage, v_sla,
            coalesce((to_jsonb(new) ->> 'workspace_id')::uuid, public.default_workspace_for_user(auth.uid())));
  end if;

  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_property_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  k text;
  old_v jsonb;
  new_v jsonb;
  entity_name text := TG_ARGV[0];
  skip_cols text[] := ARRAY['updated_at','created_at','id','owner_id'];
  v_session uuid := public.request_audit_session_id();
  v_history_id uuid;
  -- Workspace do próprio registro; antes caía no DEFAULT fixo da coluna (tenant único).
  v_ws uuid := coalesce((to_jsonb(NEW) ->> 'workspace_id')::uuid, public.default_workspace_for_user(auth.uid()));
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
      IF k = ANY(skip_cols) THEN CONTINUE; END IF;
      old_v := to_jsonb(OLD)->k;
      new_v := to_jsonb(NEW)->k;
      IF old_v IS DISTINCT FROM new_v THEN
        IF v_session IS NULL THEN
          INSERT INTO public.property_history
            (owner_id, entity, entity_id, property, old_value, new_value, changed_by, workspace_id)
          VALUES
            (NEW.owner_id, entity_name, NEW.id, k, old_v, new_v, auth.uid(), v_ws);
        ELSE
          INSERT INTO public.property_history
            (owner_id, entity, entity_id, property, old_value, new_value, changed_by, session_id, workspace_id)
          VALUES
            (NEW.owner_id, entity_name, NEW.id, k, old_v, new_v, auth.uid(), v_session, v_ws)
          ON CONFLICT (session_id, entity, entity_id, property)
            WHERE session_id IS NOT NULL
          DO UPDATE SET
            new_value = EXCLUDED.new_value,
            changed_at = clock_timestamp(),
            changed_by = EXCLUDED.changed_by
          RETURNING id INTO v_history_id;

          DELETE FROM public.property_history
          WHERE id = v_history_id
            AND old_value IS NOT DISTINCT FROM new_value;
        END IF;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;
