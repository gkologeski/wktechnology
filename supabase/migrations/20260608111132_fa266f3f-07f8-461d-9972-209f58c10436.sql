
-- Release 21: Observabilidade & Admin (platform-admin scope)

CREATE TABLE public.platform_alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL, -- 'cron_late' | 'broadcast_failure' | 'twilio_errors' | 'custom'
  threshold_pct NUMERIC,
  threshold_mins INT,
  target_key TEXT,         -- ex: nome do cron, ou 'twilio'
  channels JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{type:'email',value:'a@b.com'},{type:'slack',value:'...'}]
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_alert_rules TO authenticated;
GRANT ALL ON public.platform_alert_rules TO service_role;
ALTER TABLE public.platform_alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins manage alert rules" ON public.platform_alert_rules
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TABLE public.platform_alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.platform_alert_rules(id) ON DELETE SET NULL,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  severity TEXT NOT NULL DEFAULT 'warning', -- info | warning | critical
  message TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_alert_events TO authenticated;
GRANT ALL ON public.platform_alert_events TO service_role;
ALTER TABLE public.platform_alert_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins read alert events" ON public.platform_alert_events
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));
CREATE POLICY "platform admins write alert events" ON public.platform_alert_events
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TABLE public.platform_sandboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_workspace_id UUID NOT NULL,
  sandbox_workspace_id UUID NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active | promoted | archived
  created_by UUID NOT NULL,
  last_synced_at TIMESTAMPTZ,
  promoted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_sandboxes TO authenticated;
GRANT ALL ON public.platform_sandboxes TO service_role;
ALTER TABLE public.platform_sandboxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins manage sandboxes" ON public.platform_sandboxes
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE TRIGGER trg_alert_rules_updated BEFORE UPDATE ON public.platform_alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_sandboxes_updated BEFORE UPDATE ON public.platform_sandboxes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Função utilitária para super-admin ler status dos crons
CREATE OR REPLACE FUNCTION public.platform_cron_status()
RETURNS TABLE(jobname TEXT, schedule TEXT, last_start TIMESTAMPTZ, last_end TIMESTAMPTZ, status TEXT, duration_ms INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT j.jobname::TEXT,
         j.schedule::TEXT,
         r.start_time,
         r.end_time,
         r.status::TEXT,
         CASE WHEN r.end_time IS NOT NULL AND r.start_time IS NOT NULL
              THEN (EXTRACT(EPOCH FROM (r.end_time - r.start_time)) * 1000)::INT END
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT * FROM cron.job_run_details d
     WHERE d.jobid = j.jobid
     ORDER BY d.start_time DESC NULLS LAST LIMIT 1
  ) r ON true
  ORDER BY j.jobname;
END $$;

GRANT EXECUTE ON FUNCTION public.platform_cron_status() TO authenticated;
