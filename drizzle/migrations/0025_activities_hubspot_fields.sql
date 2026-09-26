ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS activity_date timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS task_type text,
  ADD COLUMN IF NOT EXISTS recurrence jsonb,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid,
  ADD COLUMN IF NOT EXISTS contacted_contact_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS follow_up_of uuid;

CREATE OR REPLACE FUNCTION public.activities_spawn_recurrence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r jsonb := NEW.recurrence;
  freq text; n int; base timestamptz; nxt timestamptz; ends text; cnt int; done int;
BEGIN
  IF NEW.type <> 'task' OR r IS NULL OR NOT NEW.completed OR coalesce(OLD.completed,false) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM activities WHERE recurrence_parent_id = NEW.id) THEN RETURN NEW; END IF;
  freq := coalesce(r->>'frequency','weekly');
  n := greatest(coalesce((r->>'interval')::int,1),1);
  base := coalesce(NEW.due_date, now());
  nxt := CASE freq
    WHEN 'daily' THEN base + make_interval(days => n)
    WHEN 'monthly' THEN base + make_interval(months => n)
    WHEN 'quarterly' THEN base + make_interval(months => 3*n)
    WHEN 'yearly' THEN base + make_interval(years => n)
    ELSE base + make_interval(weeks => n) END;
  ends := coalesce(r->>'ends','never');
  done := coalesce((r->>'occurrence')::int,1);
  IF ends = 'on_date' AND (r->>'end_date') IS NOT NULL AND nxt::date > (r->>'end_date')::date THEN RETURN NEW; END IF;
  IF ends = 'after' THEN
    cnt := coalesce((r->>'count')::int,1);
    IF done >= cnt THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO activities (workspace_id, owner_id, created_by, assigned_to, type, subject, body, due_date,
    remind_before_minutes, task_priority, task_type, task_status, recurrence, recurrence_parent_id,
    related_company_id, related_contact_id, related_deal_id, related_lead_id, related_ticket_id)
  VALUES (NEW.workspace_id, NEW.owner_id, NEW.created_by, NEW.assigned_to, 'task', NEW.subject, NEW.body, nxt,
    NEW.remind_before_minutes, NEW.task_priority, NEW.task_type, 'not_started',
    jsonb_set(r, '{occurrence}', to_jsonb(done+1)), NEW.id,
    NEW.related_company_id, NEW.related_contact_id, NEW.related_deal_id, NEW.related_lead_id, NEW.related_ticket_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_activities_spawn_recurrence ON public.activities;
CREATE TRIGGER trg_activities_spawn_recurrence AFTER UPDATE OF completed ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.activities_spawn_recurrence();