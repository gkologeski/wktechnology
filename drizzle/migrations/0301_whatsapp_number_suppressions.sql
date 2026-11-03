CREATE TABLE public.whatsapp_number_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  phone_key text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('no_whatsapp','engagement_limit')),
  error_count integer NOT NULL DEFAULT 1,
  last_error_code text,
  last_error_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  released_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, phone_key, reason)
);
CREATE INDEX whatsapp_number_suppressions_active_idx
  ON public.whatsapp_number_suppressions (workspace_id, phone_key) WHERE released_at IS NULL;

GRANT SELECT ON public.whatsapp_number_suppressions TO authenticated;
GRANT ALL ON public.whatsapp_number_suppressions TO service_role;
ALTER TABLE public.whatsapp_number_suppressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY wa_suppr_select ON public.whatsapp_number_suppressions
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

COMMENT ON TABLE public.whatsapp_number_suppressions IS
  'Números recusados pela Meta: 131026 (sem WhatsApp, 90 dias) e 131049 (engajamento: 7 dias; 2ª seguida = 30 dias). Gravado só por gatilho.';

CREATE OR REPLACE FUNCTION public.wa_phone_key(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN d ~ '^55\d{2}9?\d{8}$'
    THEN '+55' || substr(d,3,2) || right(d,8)
    ELSE '+' || d END
  FROM (SELECT regexp_replace(coalesce(p,''), '\D', '', 'g') AS d) s
$$;

CREATE OR REPLACE FUNCTION public.wa_record_suppression(p_ws uuid, p_phone text, p_code text, p_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text := public.wa_phone_key(p_phone); r public.whatsapp_number_suppressions;
BEGIN
  IF p_ws IS NULL OR k = '+' OR p_code NOT IN ('131026','131049') THEN RETURN; END IF;
  IF p_code = '131026' THEN
    INSERT INTO public.whatsapp_number_suppressions AS s
      (workspace_id, phone_key, reason, last_error_code, last_error_at, expires_at)
    VALUES (p_ws, k, 'no_whatsapp', p_code, p_at, p_at + interval '90 days')
    ON CONFLICT (workspace_id, phone_key, reason) DO UPDATE SET
      error_count = s.error_count + 1, last_error_code = p_code,
      last_error_at = greatest(s.last_error_at, EXCLUDED.last_error_at),
      expires_at = greatest(s.expires_at, EXCLUDED.expires_at),
      released_at = NULL, released_by = NULL, updated_at = now();
    RETURN;
  END IF;
  SELECT * INTO r FROM public.whatsapp_number_suppressions
   WHERE workspace_id = p_ws AND phone_key = k AND reason = 'engagement_limit' FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.whatsapp_number_suppressions
      (workspace_id, phone_key, reason, last_error_code, last_error_at, expires_at)
    VALUES (p_ws, k, 'engagement_limit', p_code, p_at, p_at + interval '7 days')
    ON CONFLICT DO NOTHING;
  ELSIF p_at - r.last_error_at < interval '1 minute' THEN
    RETURN; -- mesmo aviso repetido
  ELSE
    -- "seguida": nova recusa até 30 dias após a anterior conta como repetição.
    UPDATE public.whatsapp_number_suppressions SET
      error_count = CASE WHEN p_at - r.last_error_at <= interval '30 days' AND r.released_at IS NULL THEN r.error_count + 1 ELSE 1 END,
      last_error_code = p_code, last_error_at = greatest(r.last_error_at, p_at),
      expires_at = p_at + CASE WHEN p_at - r.last_error_at <= interval '30 days' AND r.released_at IS NULL
                                THEN interval '30 days' ELSE interval '7 days' END,
      released_at = NULL, released_by = NULL, updated_at = now()
    WHERE id = r.id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.wa_record_suppression(uuid,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_record_suppression(uuid,text,text,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.wa_messages_suppression_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.direction = 'outbound' AND NEW.error_code IN ('131026','131049')
     AND (TG_OP = 'INSERT' OR OLD.error_code IS DISTINCT FROM NEW.error_code) THEN
    PERFORM public.wa_record_suppression(NEW.workspace_id, NEW.to_number, NEW.error_code, now());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_wa_messages_suppression
  AFTER INSERT OR UPDATE OF error_code ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.wa_messages_suppression_trg();

CREATE OR REPLACE FUNCTION public.wa_release_number_suppression(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws uuid;
BEGIN
  SELECT workspace_id INTO ws FROM public.whatsapp_number_suppressions WHERE id = p_id;
  IF ws IS NULL OR NOT public.is_workspace_member(ws, auth.uid())
     OR NOT (public.is_workspace_admin_v2(ws, auth.uid())
             OR public.user_has_permission(auth.uid(), 'system.whatsapp.update.workspace')) THEN
    RAISE EXCEPTION 'Sem permissão para liberar este número.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.whatsapp_number_suppressions
     SET released_at = now(), released_by = auth.uid(), error_count = 0, updated_at = now()
   WHERE id = p_id;
END $$;
REVOKE ALL ON FUNCTION public.wa_release_number_suppression(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wa_release_number_suppression(uuid) TO authenticated, service_role;

-- Backfill: recusas já existentes, em ordem cronológica.
DO $$ DECLARE m record; BEGIN
  FOR m IN SELECT workspace_id, to_number, error_code, created_at FROM public.whatsapp_messages
           WHERE direction = 'outbound' AND error_code IN ('131026','131049') ORDER BY created_at LOOP
    PERFORM public.wa_record_suppression(m.workspace_id, m.to_number, m.error_code, m.created_at);
  END LOOP;
END $$;