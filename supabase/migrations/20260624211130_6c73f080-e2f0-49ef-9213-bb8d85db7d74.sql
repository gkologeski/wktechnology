-- ============ ats_offers ============
CREATE TABLE public.ats_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  application_id uuid REFERENCES public.ats_applications(id) ON DELETE SET NULL,
  candidate_id uuid NOT NULL REFERENCES public.ats_candidates(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.ats_jobs(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Carta-proposta',
  body text NOT NULL DEFAULT '',
  salary_amount numeric(14,2),
  salary_currency text NOT NULL DEFAULT 'BRL',
  start_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','signed','declined','cancelled')),
  esign_document_id uuid REFERENCES public.esign_documents(id) ON DELETE SET NULL,
  promote_to_stage text,
  sent_at timestamptz,
  signed_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ats_offers_owner ON public.ats_offers(owner_id);
CREATE INDEX idx_ats_offers_candidate ON public.ats_offers(candidate_id);
CREATE INDEX idx_ats_offers_esign ON public.ats_offers(esign_document_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ats_offers TO authenticated;
GRANT ALL ON public.ats_offers TO service_role;

ALTER TABLE public.ats_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner select offers" ON public.ats_offers FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "owner insert offers" ON public.ats_offers FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner update offers" ON public.ats_offers FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner delete offers" ON public.ats_offers FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TRIGGER trg_ats_offers_updated
BEFORE UPDATE ON public.ats_offers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Sync com eSign ============
CREATE OR REPLACE FUNCTION public.ats_offers_sync_on_esign()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total int;
  v_signed int;
  v_offer public.ats_offers%ROWTYPE;
BEGIN
  SELECT id INTO v_offer.id FROM public.ats_offers WHERE esign_document_id = NEW.document_id LIMIT 1;
  IF v_offer.id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_offer FROM public.ats_offers WHERE id = v_offer.id;

  IF NEW.status = 'declined' THEN
    UPDATE public.ats_offers
       SET status = 'declined',
           declined_at = now(),
           decline_reason = COALESCE(NEW.decline_reason, decline_reason),
           updated_at = now()
     WHERE id = v_offer.id AND status NOT IN ('signed','cancelled');
    RETURN NEW;
  END IF;

  IF NEW.status = 'signed' THEN
    SELECT count(*), count(*) FILTER (WHERE status = 'signed')
      INTO v_total, v_signed
      FROM public.esign_signers WHERE document_id = NEW.document_id;
    IF v_total > 0 AND v_signed >= v_total THEN
      UPDATE public.ats_offers
         SET status = 'signed', signed_at = now(), updated_at = now()
       WHERE id = v_offer.id;
      IF v_offer.promote_to_stage IS NOT NULL AND v_offer.application_id IS NOT NULL THEN
        UPDATE public.ats_applications
           SET stage_value = v_offer.promote_to_stage, updated_at = now()
         WHERE id = v_offer.application_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ats_offers_sync_on_esign ON public.esign_signers;
CREATE TRIGGER trg_ats_offers_sync_on_esign
AFTER UPDATE OF status ON public.esign_signers
FOR EACH ROW EXECUTE FUNCTION public.ats_offers_sync_on_esign();
