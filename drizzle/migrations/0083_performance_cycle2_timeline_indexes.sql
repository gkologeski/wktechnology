CREATE INDEX IF NOT EXISTS activities_related_deal_effective_date_idx
  ON public.activities (related_deal_id, (COALESCE(hs_createdate, created_at)) DESC, id DESC)
  WHERE related_deal_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS activities_related_contact_effective_date_idx
  ON public.activities (related_contact_id, (COALESCE(hs_createdate, created_at)) DESC, id DESC)
  WHERE related_contact_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS activities_related_company_effective_date_idx
  ON public.activities (related_company_id, (COALESCE(hs_createdate, created_at)) DESC, id DESC)
  WHERE related_company_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS activities_related_lead_effective_date_idx
  ON public.activities (related_lead_id, (COALESCE(hs_createdate, created_at)) DESC, id DESC)
  WHERE related_lead_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS activities_related_ticket_effective_date_idx
  ON public.activities (related_ticket_id, (COALESCE(hs_createdate, created_at)) DESC, id DESC)
  WHERE related_ticket_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS property_history_entity_stable_cursor_idx
  ON public.property_history (entity, entity_id, changed_at DESC, id DESC);