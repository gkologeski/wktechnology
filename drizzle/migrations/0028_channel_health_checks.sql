CREATE TABLE public.channel_health_checks (
  channel text PRIMARY KEY,
  ready boolean NOT NULL,
  reason text,
  transient boolean NOT NULL DEFAULT false,
  checked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.channel_health_checks TO authenticated;
GRANT ALL ON public.channel_health_checks TO service_role;
ALTER TABLE public.channel_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read channel health"
  ON public.channel_health_checks FOR SELECT TO authenticated USING (true);