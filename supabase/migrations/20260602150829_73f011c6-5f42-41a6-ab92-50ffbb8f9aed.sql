-- Tabela privada de configuração de app (apenas service_role)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.app_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
-- Sem policies: apenas service_role (que bypassa RLS) lê/escreve.

-- Reescreve o trigger para ler o segredo da tabela em vez do GUC
CREATE OR REPLACE FUNCTION public.trigger_bug_report_analysis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_secret TEXT;
  v_url TEXT := 'https://project--68dcfa85-b6da-4030-a825-b896ca621e0c.lovable.app/api/public/hooks/bug-report-analyze';
BEGIN
  SELECT value INTO v_secret FROM public.app_settings WHERE key = 'cron_secret';

  IF v_secret IS NULL OR length(v_secret) < 8 THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object('bug_report_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;