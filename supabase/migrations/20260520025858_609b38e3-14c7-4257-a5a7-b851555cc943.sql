
CREATE TABLE public.forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  target TEXT NOT NULL DEFAULT 'lead' CHECK (target IN ('lead','contact')),
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  success_message TEXT NOT NULL DEFAULT 'Obrigado pelo contato!',
  redirect_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  submit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_forms_owner ON public.forms(owner_id);
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "forms_select_owner_admin" ON public.forms FOR SELECT
USING (auth.uid() = owner_id OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE POLICY "forms_insert_owner" ON public.forms FOR INSERT
WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "forms_update_owner_admin" ON public.forms FOR UPDATE
USING (auth.uid() = owner_id OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE POLICY "forms_delete_owner_admin" ON public.forms FOR DELETE
USING (auth.uid() = owner_id OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE TRIGGER forms_updated BEFORE UPDATE ON public.forms
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  lead_id UUID,
  contact_id UUID,
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_form_submissions_form ON public.form_submissions(form_id);
CREATE INDEX idx_form_submissions_owner ON public.form_submissions(owner_id);
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "form_subs_select_owner_admin" ON public.form_submissions FOR SELECT
USING (auth.uid() = owner_id OR public.is_workspace_admin(auth.uid(), owner_id));
CREATE POLICY "form_subs_delete_owner_admin" ON public.form_submissions FOR DELETE
USING (auth.uid() = owner_id OR public.is_workspace_admin(auth.uid(), owner_id));
