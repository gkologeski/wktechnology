CREATE INDEX IF NOT EXISTS activities_deal_pending_due_idx
  ON public.activities (workspace_id, due_date, related_deal_id, owner_id)
  WHERE completed = false AND related_deal_id IS NOT NULL AND due_date IS NOT NULL;