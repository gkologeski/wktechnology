-- Sprint 8 - Hardening: idempotência do cron de billing de serviços recorrentes.
-- Impede duplicidade se o tick rodar duas vezes ou se o update de next_billing_at falhar.
CREATE UNIQUE INDEX IF NOT EXISTS financial_entries_service_competence_uniq
  ON public.financial_entries (service_id, competence_date)
  WHERE origin_type = 'service' AND service_id IS NOT NULL;