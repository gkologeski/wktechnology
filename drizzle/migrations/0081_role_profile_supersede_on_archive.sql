CREATE OR REPLACE FUNCTION public.role_profile_supersede_on_edit()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.data, NEW.title, NEW.quantity, NEW.modality, NEW.seniority, NEW.priority, NEW.archived_at)
     IS DISTINCT FROM (OLD.data, OLD.title, OLD.quantity, OLD.modality, OLD.seniority, OLD.priority, OLD.archived_at) THEN
    UPDATE public.role_profile_approval_items SET status = 'superseded'
     WHERE profile_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END $function$;