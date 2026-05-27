
DO $mig$
DECLARE v_ws uuid := '184b9435-0a9b-4334-9e89-8854dc883f5d'; t text;
  v_tables text[] := ARRAY['calendar_accounts','calendar_events','companies','contact_subscriptions','contacts'];
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS workspace_id uuid NOT NULL DEFAULT %L', t, v_ws);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN workspace_id DROP DEFAULT', t);
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t||'_workspace_id_fkey');
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE', t, t||'_workspace_id_fkey');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (workspace_id)', 'idx_'||t||'_workspace_id', t);
  END LOOP;
END $mig$;
