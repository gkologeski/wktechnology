
-- 1) Pools
CREATE TABLE public.ats_interviewer_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  rotation_strategy text NOT NULL DEFAULT 'round_robin' CHECK (rotation_strategy IN ('round_robin','load_balanced')),
  rotation_cursor integer NOT NULL DEFAULT 0,
  load_window_days integer NOT NULL DEFAULT 14,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_interviewer_pools TO authenticated;
GRANT ALL ON public.ats_interviewer_pools TO service_role;
ALTER TABLE public.ats_interviewer_pools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pools owner all" ON public.ats_interviewer_pools FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 2) Members
CREATE TABLE public.ats_interviewer_pool_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  pool_id uuid NOT NULL REFERENCES public.ats_interviewer_pools(id) ON DELETE CASCADE,
  interviewer_id uuid NOT NULL,
  weight integer NOT NULL DEFAULT 1 CHECK (weight >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, interviewer_id)
);
CREATE INDEX ats_pool_members_pool_idx ON public.ats_interviewer_pool_members(pool_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_interviewer_pool_members TO authenticated;
GRANT ALL ON public.ats_interviewer_pool_members TO service_role;
ALTER TABLE public.ats_interviewer_pool_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pool members owner all" ON public.ats_interviewer_pool_members FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 3) Availability (weekly recurring windows)
CREATE TABLE public.ats_interviewer_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  interviewer_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=domingo
  start_minute smallint NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute smallint NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_minute > start_minute)
);
CREATE INDEX ats_availability_interviewer_idx ON public.ats_interviewer_availability(interviewer_id, weekday);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_interviewer_availability TO authenticated;
GRANT ALL ON public.ats_interviewer_availability TO service_role;
ALTER TABLE public.ats_interviewer_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "availability owner all" ON public.ats_interviewer_availability FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 4) Extend ats_interviews
ALTER TABLE public.ats_interviews
  ADD COLUMN IF NOT EXISTS pool_id uuid REFERENCES public.ats_interviewer_pools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS panel_interviewer_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS auto_rescheduled_from uuid REFERENCES public.ats_interviews(id) ON DELETE SET NULL;

-- 5) updated_at trigger for pools
CREATE OR REPLACE FUNCTION public.ats_pools_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER ats_pools_updated_at
  BEFORE UPDATE ON public.ats_interviewer_pools
  FOR EACH ROW EXECUTE FUNCTION public.ats_pools_touch_updated_at();
