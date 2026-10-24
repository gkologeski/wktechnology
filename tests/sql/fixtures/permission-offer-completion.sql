CREATE OR REPLACE FUNCTION public.esign_check_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total INT;
  v_signed INT;
  v_declined INT;
BEGIN
  SELECT COUNT(*) FILTER (WHERE true),
         COUNT(*) FILTER (WHERE status = 'signed'),
         COUNT(*) FILTER (WHERE status = 'declined')
    INTO v_total, v_signed, v_declined
  FROM public.esign_signers WHERE document_id = NEW.document_id;

  IF v_declined > 0 THEN
    UPDATE public.esign_documents
       SET status = 'declined', completed_at = COALESCE(completed_at, now())
     WHERE id = NEW.document_id AND status NOT IN ('declined','canceled');
  ELSIF v_signed = v_total AND v_total > 0 THEN
    UPDATE public.esign_documents
       SET status = 'completed', completed_at = COALESCE(completed_at, now())
     WHERE id = NEW.document_id AND status <> 'completed';
  ELSIF v_signed > 0 THEN
    UPDATE public.esign_documents
       SET status = 'partially_signed'
     WHERE id = NEW.document_id AND status IN ('sent','draft');
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER esign_signers_completion AFTER UPDATE OF status ON public.esign_signers FOR EACH ROW EXECUTE FUNCTION public.esign_check_completion();
