-- Corrige a derivação de workspace_id nos eventos de People.
-- Antes: o trigger copiava `owner_id` (que pode ser um user id) para
-- `workspace_id`, violando a FK people_events_workspace_id_fkey e impedindo o
-- cadastro de pessoas. Agora só copia quando o valor é realmente um workspace.
CREATE OR REPLACE FUNCTION public.people_child_sync_workspace_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ws uuid;
BEGIN
  IF NEW.workspace_id IS NULL THEN
    -- 1) preferir o workspace da pessoa associada
    IF NEW.person_id IS NOT NULL THEN
      SELECT p.workspace_id INTO v_ws FROM public.people p WHERE p.id = NEW.person_id;
      NEW.workspace_id := v_ws;
    END IF;
    -- 2) compatibilidade legada: owner_id preenchido com um workspace id
    IF NEW.workspace_id IS NULL AND NEW.owner_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = NEW.owner_id) THEN
      NEW.workspace_id := NEW.owner_id;
    END IF;
    -- 3) fallback: workspace padrão do usuário dono
    IF NEW.workspace_id IS NULL AND NEW.owner_id IS NOT NULL THEN
      NEW.workspace_id := public.default_workspace_for_user(NEW.owner_id);
    END IF;
  END IF;
  IF NEW.owner_id IS NULL THEN NEW.owner_id := NEW.workspace_id; END IF;
  RETURN NEW;
END;
$$;

-- O log automático de eventos passa a informar o workspace da própria pessoa,
-- em vez de depender da inferência a partir de owner_id.
CREATE OR REPLACE FUNCTION public.people_log_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.people_events (workspace_id, owner_id, person_id, event_type, title, actor_id)
    VALUES (NEW.workspace_id, NEW.workspace_id, NEW.id, 'hired', 'Pessoa cadastrada', NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.people_events (workspace_id, owner_id, person_id, event_type, title, description, actor_id)
    VALUES (NEW.workspace_id, NEW.workspace_id, NEW.id, 'status_changed',
            'Status alterado: ' || OLD.status::text || ' → ' || NEW.status::text,
            NULL, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;