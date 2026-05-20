DO $$ BEGIN
  CREATE TYPE public.booking_status AS ENUM ('confirmed', 'canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.booking_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 5 AND 480),
  buffer_before_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_before_minutes BETWEEN 0 AND 240),
  buffer_after_minutes integer NOT NULL DEFAULT 0 CHECK (buffer_after_minutes BETWEEN 0 AND 240),
  calendar_account_id uuid REFERENCES public.calendar_accounts(id) ON DELETE SET NULL,
  availability jsonb NOT NULL DEFAULT '{}'::jsonb,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  min_notice_hours integer NOT NULL DEFAULT 2 CHECK (min_notice_hours BETWEEN 0 AND 720),
  max_advance_days integer NOT NULL DEFAULT 30 CHECK (max_advance_days BETWEEN 1 AND 365),
  active boolean NOT NULL DEFAULT true,
  target text NOT NULL DEFAULT 'lead' CHECK (target IN ('lead','contact')),
  color text NOT NULL DEFAULT '#6366f1',
  location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_pages_owner_idx ON public.booking_pages(owner_id);

ALTER TABLE public.booking_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "booking_pages owner select" ON public.booking_pages;
CREATE POLICY "booking_pages owner select" ON public.booking_pages
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));

DROP POLICY IF EXISTS "booking_pages owner write" ON public.booking_pages;
CREATE POLICY "booking_pages owner write" ON public.booking_pages
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id))
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.booking_pages(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  invitee_name text NOT NULL,
  invitee_email text NOT NULL,
  invitee_phone text,
  notes text,
  status public.booking_status NOT NULL DEFAULT 'confirmed',
  gcal_event_id text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  timezone text,
  canceled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_page_idx ON public.bookings(page_id);
CREATE INDEX IF NOT EXISTS bookings_owner_idx ON public.bookings(owner_id);
CREATE INDEX IF NOT EXISTS bookings_start_idx ON public.bookings(start_at);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings owner select" ON public.bookings;
CREATE POLICY "bookings owner select" ON public.bookings
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));

DROP POLICY IF EXISTS "bookings owner write" ON public.bookings;
CREATE POLICY "bookings owner write" ON public.bookings
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id))
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin(auth.uid(), owner_id));

DROP TRIGGER IF EXISTS booking_pages_set_updated ON public.booking_pages;
CREATE TRIGGER booking_pages_set_updated BEFORE UPDATE ON public.booking_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS bookings_set_updated ON public.bookings;
CREATE TRIGGER bookings_set_updated BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();