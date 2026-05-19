
-- Enums
CREATE TYPE public.esign_doc_status AS ENUM ('draft','sent','partially_signed','completed','declined','expired','canceled');
CREATE TYPE public.esign_signer_status AS ENUM ('pending','viewed','signed','declined');

-- Documents
CREATE TABLE public.esign_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  body TEXT NOT NULL DEFAULT '',
  status public.esign_doc_status NOT NULL DEFAULT 'draft',
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ordered BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX esign_documents_owner_idx ON public.esign_documents(owner_id);
CREATE INDEX esign_documents_deal_idx ON public.esign_documents(deal_id);

-- Signers
CREATE TABLE public.esign_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.esign_documents(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  sign_order INT NOT NULL DEFAULT 1,
  status public.esign_signer_status NOT NULL DEFAULT 'pending',
  public_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  signed_name TEXT,
  signature_data TEXT,
  ip_address TEXT,
  user_agent TEXT,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX esign_signers_doc_idx ON public.esign_signers(document_id);
CREATE INDEX esign_signers_token_idx ON public.esign_signers(public_token);

-- Audit
CREATE TABLE public.esign_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.esign_documents(id) ON DELETE CASCADE,
  signer_id UUID REFERENCES public.esign_signers(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL,
  event TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX esign_audit_doc_idx ON public.esign_audit(document_id);

-- RLS
ALTER TABLE public.esign_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esign_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.esign_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esign_docs owner/admin all" ON public.esign_documents
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

CREATE POLICY "esign_signers owner/admin all" ON public.esign_signers
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

CREATE POLICY "esign_audit owner/admin read" ON public.esign_audit
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

CREATE POLICY "esign_audit owner/admin write" ON public.esign_audit
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() OR public.is_workspace_admin(owner_id, auth.uid()));

-- updated_at
CREATE TRIGGER esign_documents_set_updated
BEFORE UPDATE ON public.esign_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-complete when all signers signed
CREATE OR REPLACE FUNCTION public.esign_check_completion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total INT;
  v_signed INT;
  v_declined INT;
BEGIN
  SELECT COUNT(*) FILTER (WHERE true),
         COUNT(*) FILTER (WHERE status = 'signed'),
         COUNT(*) FILTER (WHERE status = 'declined')
    INTO v_total, v_signed, v_declined
  FROM public.esign_signers WHERE document_id = NEW.document_id;

  IF v_declined > 0 THEN
    UPDATE public.esign_documents
       SET status = 'declined', completed_at = COALESCE(completed_at, now())
     WHERE id = NEW.document_id AND status NOT IN ('declined','canceled');
  ELSIF v_signed = v_total AND v_total > 0 THEN
    UPDATE public.esign_documents
       SET status = 'completed', completed_at = COALESCE(completed_at, now())
     WHERE id = NEW.document_id AND status <> 'completed';
  ELSIF v_signed > 0 THEN
    UPDATE public.esign_documents
       SET status = 'partially_signed'
     WHERE id = NEW.document_id AND status IN ('sent','draft');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER esign_signers_completion
AFTER UPDATE OF status ON public.esign_signers
FOR EACH ROW EXECUTE FUNCTION public.esign_check_completion();
