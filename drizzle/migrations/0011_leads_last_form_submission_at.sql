ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_form_submission_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_last_form_submission_at
  ON public.leads (workspace_id, last_form_submission_at DESC)
  WHERE last_form_submission_at IS NOT NULL;

-- Em UPDATE, só verifica duplicidade quando e-mail/telefone realmente mudaram.
-- Sem isso, qualquer edição de um lead legado duplicado é bloqueada.
CREATE OR REPLACE FUNCTION public.leads_check_duplicate()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  normalized_phone text;
  existing_id uuid;
  check_email boolean := true;
  check_phone boolean := true;
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
    NEW.email := lower(trim(NEW.email));
  END IF;

  IF NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
    normalized_phone := regexp_replace(NEW.phone, '[^0-9]', '', 'g');
  END IF;

  IF TG_OP = 'UPDATE' THEN
    check_email := NEW.email IS DISTINCT FROM lower(trim(coalesce(OLD.email, '')))
      AND NEW.email IS DISTINCT FROM OLD.email;
    check_phone := regexp_replace(coalesce(NEW.phone, ''), '[^0-9]', '', 'g')
      IS DISTINCT FROM regexp_replace(coalesce(OLD.phone, ''), '[^0-9]', '', 'g');
  END IF;

  IF check_email AND NEW.email IS NOT NULL AND NEW.email <> '' THEN
    SELECT id INTO existing_id
    FROM public.leads
    WHERE workspace_id = NEW.workspace_id
      AND deleted_at IS NULL
      AND lower(email) = NEW.email
      AND id IS DISTINCT FROM NEW.id
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'Já existe um lead com o e-mail % neste workspace.', NEW.email
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  IF check_phone AND normalized_phone IS NOT NULL AND normalized_phone <> '' THEN
    SELECT id INTO existing_id
    FROM public.leads
    WHERE workspace_id = NEW.workspace_id
      AND deleted_at IS NULL
      AND regexp_replace(phone, '[^0-9]', '', 'g') = normalized_phone
      AND id IS DISTINCT FROM NEW.id
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'Já existe um lead com o telefone % neste workspace.', NEW.phone
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

UPDATE public.leads l
SET last_form_submission_at = s.max_created
FROM (
  SELECT lead_id, max(created_at) AS max_created
  FROM public.form_submissions
  WHERE lead_id IS NOT NULL
  GROUP BY lead_id
) s
WHERE s.lead_id = l.id
  AND l.last_form_submission_at IS NULL;