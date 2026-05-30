-- 1) Update activities-based auto-advance: triggered on insert of activity (call/email/meeting)
--    linked to a lead with status 'new' → move to 'contacted'.
DROP TRIGGER IF EXISTS trg_auto_advance_lead_stage ON public.activities;
CREATE TRIGGER trg_auto_advance_lead_stage
AFTER INSERT ON public.activities
FOR EACH ROW
EXECUTE FUNCTION public.auto_advance_lead_stage();

-- 2) Inbound email replies: when an inbound email arrives, find leads owned by the
--    same workspace whose email matches the sender and whose status is 'new',
--    then move them to 'contacted'.
CREATE OR REPLACE FUNCTION public.auto_advance_lead_on_inbound_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.direction = 'inbound' AND NEW.from_email IS NOT NULL THEN
    UPDATE public.leads
       SET status = 'contacted'
     WHERE status = 'new'
       AND owner_id = NEW.owner_id
       AND lower(email) = lower(NEW.from_email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_advance_lead_on_inbound_email ON public.email_messages;
CREATE TRIGGER trg_auto_advance_lead_on_inbound_email
AFTER INSERT ON public.email_messages
FOR EACH ROW
EXECUTE FUNCTION public.auto_advance_lead_on_inbound_email();