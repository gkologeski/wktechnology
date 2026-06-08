
-- Release 14: Documents & Contracts

-- 1) Proposal status enum
DO $$ BEGIN
  CREATE TYPE public.proposal_status AS ENUM ('draft','in_review','approved','sent','accepted','rejected','expired','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.proposal_approval_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Proposals
CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  status public.proposal_status NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  locked boolean NOT NULL DEFAULT false,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  esign_document_id uuid REFERENCES public.esign_documents(id) ON DELETE SET NULL,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_amount numeric(14,2),
  currency text NOT NULL DEFAULT 'BRL',
  expires_at timestamptz,
  sent_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select_proposals" ON public.proposals FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "ws_insert_proposals" ON public.proposals FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "ws_update_proposals" ON public.proposals FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "ws_delete_proposals" ON public.proposals FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE INDEX IF NOT EXISTS proposals_workspace_idx ON public.proposals(workspace_id);
CREATE INDEX IF NOT EXISTS proposals_deal_idx ON public.proposals(deal_id);
CREATE INDEX IF NOT EXISTS proposals_status_idx ON public.proposals(status);
CREATE TRIGGER proposals_set_updated BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_set_workspace_proposals BEFORE INSERT ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_on_insert();

-- 3) Clause library
CREATE TABLE IF NOT EXISTS public.proposal_clauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  category text,
  body text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_clauses TO authenticated;
GRANT ALL ON public.proposal_clauses TO service_role;
ALTER TABLE public.proposal_clauses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select_clauses" ON public.proposal_clauses FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "ws_insert_clauses" ON public.proposal_clauses FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "ws_update_clauses" ON public.proposal_clauses FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "ws_delete_clauses" ON public.proposal_clauses FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE TRIGGER proposal_clauses_set_updated BEFORE UPDATE ON public.proposal_clauses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_set_workspace_proposal_clauses BEFORE INSERT ON public.proposal_clauses
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_on_insert();

-- 4) Approvals
CREATE TABLE IF NOT EXISTS public.proposal_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  reviewer_id uuid,
  status public.proposal_approval_status NOT NULL DEFAULT 'pending',
  comment text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_approvals TO authenticated;
GRANT ALL ON public.proposal_approvals TO service_role;
ALTER TABLE public.proposal_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select_proposal_approvals" ON public.proposal_approvals FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "ws_insert_proposal_approvals" ON public.proposal_approvals FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "ws_update_proposal_approvals" ON public.proposal_approvals FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "ws_delete_proposal_approvals" ON public.proposal_approvals FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE INDEX IF NOT EXISTS proposal_approvals_proposal_idx ON public.proposal_approvals(proposal_id);
CREATE TRIGGER trg_set_workspace_proposal_approvals BEFORE INSERT ON public.proposal_approvals
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_on_insert();

-- 5) E-sign attachments
CREATE TABLE IF NOT EXISTS public.esign_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.esign_documents(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  mime_type text,
  size_bytes integer,
  sha256 text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.esign_attachments TO authenticated;
GRANT ALL ON public.esign_attachments TO service_role;
ALTER TABLE public.esign_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select_esign_attachments" ON public.esign_attachments FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "ws_insert_esign_attachments" ON public.esign_attachments FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "ws_update_esign_attachments" ON public.esign_attachments FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()))
  WITH CHECK (workspace_id IN (SELECT current_user_workspaces()));
CREATE POLICY "ws_delete_esign_attachments" ON public.esign_attachments FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT current_user_workspaces()));
CREATE INDEX IF NOT EXISTS esign_attachments_doc_idx ON public.esign_attachments(document_id);
CREATE TRIGGER trg_set_workspace_esign_attachments BEFORE INSERT ON public.esign_attachments
  FOR EACH ROW EXECUTE FUNCTION public.set_workspace_on_insert();

-- 6) Hash seal on esign_documents
ALTER TABLE public.esign_documents
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS sealed_at timestamptz;

CREATE INDEX IF NOT EXISTS esign_documents_hash_idx ON public.esign_documents(content_hash);

-- 7) Public verify function (returns minimal info: title, sealed_at, status)
CREATE OR REPLACE FUNCTION public.esign_verify_hash(_hash text)
RETURNS TABLE (
  document_id uuid,
  title text,
  status public.esign_doc_status,
  sealed_at timestamptz,
  signers_count integer,
  signed_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.title, d.status, d.sealed_at,
    (SELECT count(*)::int FROM public.esign_signers s WHERE s.document_id = d.id),
    (SELECT count(*)::int FROM public.esign_signers s WHERE s.document_id = d.id AND s.status = 'signed')
  FROM public.esign_documents d
  WHERE d.content_hash = _hash
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.esign_verify_hash(text) TO anon, authenticated;
