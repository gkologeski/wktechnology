CREATE INDEX IF NOT EXISTS tickets_assignee_id_idx ON public.tickets (assignee_id);

CREATE OR REPLACE FUNCTION public.is_own_record(_owner_id uuid, _assigned_to uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (_assigned_to = auth.uid() OR (_assigned_to IS NULL AND _owner_id = auth.uid()));
$$;

GRANT EXECUTE ON FUNCTION public.is_own_record(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_responsible_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec jsonb := to_jsonb(NEW);
BEGIN
  IF TG_OP = 'INSERT' AND (rec ? 'assigned_to') AND NEW.assigned_to IS NULL THEN
    IF (rec ? 'owner_id') THEN
      NEW.assigned_to := NEW.owner_id;
    END IF;
  END IF;

  IF (rec ? 'assigned_user_id') AND (rec ? 'assigned_to') THEN
    NEW.assigned_user_id := NEW.assigned_to;
  END IF;

  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.tickets_sync_responsible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.assignee_id IS NULL THEN
    NEW.assignee_id := NEW.owner_id;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_tickets_sync_responsible ON public.tickets;
CREATE TRIGGER trg_tickets_sync_responsible
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tickets_sync_responsible();