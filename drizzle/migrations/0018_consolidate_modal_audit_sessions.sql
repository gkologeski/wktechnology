ALTER TABLE public.property_history
  ADD COLUMN IF NOT EXISTS session_id uuid;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS session_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS property_history_session_change_uidx
  ON public.property_history (session_id, entity, entity_id, property)
  WHERE session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS audit_logs_session_update_uidx
  ON public.audit_logs (session_id, entity, entity_id, action)
  WHERE session_id IS NOT NULL AND action = 'updated';

CREATE OR REPLACE FUNCTION public.request_audit_session_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_raw text;
BEGIN
  v_raw := (NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-audit-session');
  IF v_raw IS NULL OR v_raw = '' THEN
    RETURN NULL;
  END IF;
  RETURN v_raw::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_audit_session_id() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_property_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  k text;
  old_v jsonb;
  new_v jsonb;
  entity_name text := TG_ARGV[0];
  skip_cols text[] := ARRAY['updated_at','created_at','id','owner_id'];
  v_session uuid := public.request_audit_session_id();
  v_history_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
      IF k = ANY(skip_cols) THEN CONTINUE; END IF;
      old_v := to_jsonb(OLD)->k;
      new_v := to_jsonb(NEW)->k;
      IF old_v IS DISTINCT FROM new_v THEN
        IF v_session IS NULL THEN
          INSERT INTO public.property_history
            (owner_id, entity, entity_id, property, old_value, new_value, changed_by)
          VALUES
            (NEW.owner_id, entity_name, NEW.id, k, old_v, new_v, auth.uid());
        ELSE
          INSERT INTO public.property_history
            (owner_id, entity, entity_id, property, old_value, new_value, changed_by, session_id)
          VALUES
            (NEW.owner_id, entity_name, NEW.id, k, old_v, new_v, auth.uid(), v_session)
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
$$;

CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_entity text := TG_ARGV[0];
  v_owner uuid;
  v_id uuid;
  v_action text;
  v_before jsonb;
  v_after jsonb;
  v_session uuid;
  v_log_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_owner := NEW.owner_id;
    v_id := NEW.id;
    v_before := NULL;
    v_after := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated';
    v_owner := NEW.owner_id;
    v_id := NEW.id;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
    IF v_before IS NOT DISTINCT FROM v_after THEN
      RETURN NULL;
    END IF;
    v_session := public.request_audit_session_id();
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_owner := OLD.owner_id;
    v_id := OLD.id;
    v_before := to_jsonb(OLD);
    v_after := NULL;
  ELSE
    RETURN NULL;
  END IF;

  IF v_session IS NULL OR v_action <> 'updated' THEN
    INSERT INTO public.audit_logs
      (workspace_owner_id, actor_user_id, entity, entity_id, action, before, after)
    VALUES
      (v_owner, auth.uid(), v_entity, v_id, v_action, v_before, v_after);
  ELSE
    INSERT INTO public.audit_logs
      (workspace_owner_id, actor_user_id, entity, entity_id, action, before, after, session_id)
    VALUES
      (v_owner, auth.uid(), v_entity, v_id, v_action, v_before, v_after, v_session)
    ON CONFLICT (session_id, entity, entity_id, action)
      WHERE session_id IS NOT NULL AND action = 'updated'
    DO UPDATE SET
      after = EXCLUDED.after,
      actor_user_id = EXCLUDED.actor_user_id,
      created_at = clock_timestamp()
    RETURNING id INTO v_log_id;

    DELETE FROM public.audit_logs
    WHERE id = v_log_id
      AND before IS NOT DISTINCT FROM after;
  END IF;

  RETURN NULL;
END;
$$;