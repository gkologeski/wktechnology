CREATE TABLE public.deal_loss_reasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  workspace_id UUID,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  hubspot_synced_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, value)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_loss_reasons TO authenticated;
GRANT ALL ON public.deal_loss_reasons TO service_role;

ALTER TABLE public.deal_loss_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view loss reasons"
  ON public.deal_loss_reasons FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_member(owner_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Workspace admins can insert loss reasons"
  ON public.deal_loss_reasons FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    OR public.is_workspace_admin(owner_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Workspace admins can update loss reasons"
  ON public.deal_loss_reasons FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_admin(owner_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY "Workspace admins can delete loss reasons"
  ON public.deal_loss_reasons FOR DELETE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_admin(owner_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE TRIGGER trg_deal_loss_reasons_updated_at
  BEFORE UPDATE ON public.deal_loss_reasons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_deal_loss_reasons_owner ON public.deal_loss_reasons (owner_id, is_active, sort_order);