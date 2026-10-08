CREATE OR REPLACE FUNCTION public.meetings_default_assigned_to()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.assigned_to IS NULL THEN
    NEW.assigned_to := NEW.host_user_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS meetings_default_assigned_to ON public.meetings;
CREATE TRIGGER meetings_default_assigned_to BEFORE INSERT ON public.meetings
FOR EACH ROW EXECUTE FUNCTION public.meetings_default_assigned_to();