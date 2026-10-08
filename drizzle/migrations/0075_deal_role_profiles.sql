
CREATE OR REPLACE FUNCTION public.role_profile_can(_workspace uuid, _key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
     AND public.is_workspace_member(_workspace, auth.uid())
     AND public.user_has_permission(auth.uid(), _workspace, _key);
$$;
GRANT EXECUTE ON FUNCTION public.role_profile_can(uuid, text) TO authenticated, service_role;

CREATE TABLE public.deal_role_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 999),
  modality text NOT NULL DEFAULT 'outsourcing' CHECK (modality IN ('outsourcing','hunting','both')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  seniority text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','awaiting_info','in_validation','approved','forwarded')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision integer NOT NULL DEFAULT 1,
  approved_version_id uuid,
  last_version integer NOT NULL DEFAULT 0,
  ats_job_id uuid REFERENCES public.ats_jobs(id) ON DELETE SET NULL,
  ats_synced_version integer,
  assigned_to uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE INDEX deal_role_profiles_deal_idx ON public.deal_role_profiles(workspace_id, deal_id) WHERE archived_at IS NULL;
GRANT SELECT, INSERT, UPDATE ON public.deal_role_profiles TO authenticated;
GRANT ALL ON public.deal_role_profiles TO service_role;
ALTER TABLE public.deal_role_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY drp_select ON public.deal_role_profiles FOR SELECT TO authenticated
  USING (public.role_profile_can(workspace_id, 'techsales.role_profiles.view.workspace')
         AND EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id));
CREATE POLICY drp_insert ON public.deal_role_profiles FOR INSERT TO authenticated
  WITH CHECK (public.role_profile_can(workspace_id, 'techsales.role_profiles.create.workspace')
         AND created_by = auth.uid()
         AND EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id AND d.workspace_id = deal_role_profiles.workspace_id));
CREATE POLICY drp_update ON public.deal_role_profiles FOR UPDATE TO authenticated
  USING (public.role_profile_can(workspace_id, 'techsales.role_profiles.update.workspace')
         AND EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id))
  WITH CHECK (public.role_profile_can(workspace_id, 'techsales.role_profiles.update.workspace'));

CREATE TABLE public.deal_role_profile_commercial (
  profile_id uuid PRIMARY KEY REFERENCES public.deal_role_profiles(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.deal_role_profile_commercial TO authenticated;
GRANT ALL ON public.deal_role_profile_commercial TO service_role;
ALTER TABLE public.deal_role_profile_commercial ENABLE ROW LEVEL SECURITY;
CREATE POLICY drpc_select ON public.deal_role_profile_commercial FOR SELECT TO authenticated
  USING (public.role_profile_can(workspace_id, 'techsales.role_profiles_commercial.view.workspace')
         AND EXISTS (SELECT 1 FROM public.deal_role_profiles p WHERE p.id = profile_id));
CREATE POLICY drpc_write ON public.deal_role_profile_commercial FOR INSERT TO authenticated
  WITH CHECK (public.role_profile_can(workspace_id, 'techsales.role_profiles_commercial.view.workspace')
         AND public.role_profile_can(workspace_id, 'techsales.role_profiles.update.workspace')
         AND EXISTS (SELECT 1 FROM public.deal_role_profiles p WHERE p.id = profile_id AND p.workspace_id = deal_role_profile_commercial.workspace_id));
CREATE POLICY drpc_update ON public.deal_role_profile_commercial FOR UPDATE TO authenticated
  USING (public.role_profile_can(workspace_id, 'techsales.role_profiles_commercial.view.workspace')
         AND public.role_profile_can(workspace_id, 'techsales.role_profiles.update.workspace'))
  WITH CHECK (public.role_profile_can(workspace_id, 'techsales.role_profiles_commercial.view.workspace'));

CREATE TABLE public.deal_role_profile_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.deal_role_profiles(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  commercial_snapshot jsonb,
  approved_by uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, version)
);
GRANT SELECT (id, profile_id, workspace_id, version, snapshot, approved_by, approved_at) ON public.deal_role_profile_versions TO authenticated;
GRANT ALL ON public.deal_role_profile_versions TO service_role;
ALTER TABLE public.deal_role_profile_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY drpv_select ON public.deal_role_profile_versions FOR SELECT TO authenticated
  USING (public.role_profile_can(workspace_id, 'techsales.role_profiles.view.workspace')
         AND EXISTS (SELECT 1 FROM public.deal_role_profiles p WHERE p.id = profile_id));

ALTER TABLE public.deal_role_profiles
  ADD CONSTRAINT deal_role_profiles_approved_version_fk FOREIGN KEY (approved_version_id)
  REFERENCES public.deal_role_profile_versions(id) ON DELETE SET NULL;

CREATE TABLE public.deal_role_profile_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.deal_role_profiles(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind text NOT NULL,
  from_status text,
  to_status text,
  version integer,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  actor_kind text NOT NULL DEFAULT 'user' CHECK (actor_kind IN ('user','client','system')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX deal_role_profile_events_profile_idx ON public.deal_role_profile_events(profile_id, created_at DESC);
GRANT SELECT, INSERT ON public.deal_role_profile_events TO authenticated;
GRANT ALL ON public.deal_role_profile_events TO service_role;
ALTER TABLE public.deal_role_profile_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY drpe_select ON public.deal_role_profile_events FOR SELECT TO authenticated
  USING (public.role_profile_can(workspace_id, 'techsales.role_profiles.view.workspace')
         AND EXISTS (SELECT 1 FROM public.deal_role_profiles p WHERE p.id = profile_id));
CREATE POLICY drpe_insert ON public.deal_role_profile_events FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() AND actor_kind = 'user'
         AND public.role_profile_can(workspace_id, 'techsales.role_profiles.view.workspace')
         AND EXISTS (SELECT 1 FROM public.deal_role_profiles p WHERE p.id = profile_id AND p.workspace_id = deal_role_profile_events.workspace_id));

CREATE TABLE public.deal_role_profile_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.deal_role_profiles(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  filename text NOT NULL,
  mime text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  uploaded_by uuid,
  uploaded_by_kind text NOT NULL DEFAULT 'user' CHECK (uploaded_by_kind IN ('user','client')),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT ON public.deal_role_profile_attachments TO authenticated;
GRANT ALL ON public.deal_role_profile_attachments TO service_role;
ALTER TABLE public.deal_role_profile_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY drpa_select ON public.deal_role_profile_attachments FOR SELECT TO authenticated
  USING (public.role_profile_can(workspace_id, 'techsales.role_profiles.view.workspace')
         AND EXISTS (SELECT 1 FROM public.deal_role_profiles p WHERE p.id = profile_id));

CREATE TABLE public.deal_role_profile_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.deal_role_profiles(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  base_revision integer NOT NULL,
  token_hash text NOT NULL UNIQUE,
  allowed_fields text[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  max_reads integer NOT NULL DEFAULT 50,
  read_count integer NOT NULL DEFAULT 0,
  max_writes integer NOT NULL DEFAULT 5,
  write_count integer NOT NULL DEFAULT 0,
  last_access_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT (id, profile_id, workspace_id, base_revision, allowed_fields, expires_at, revoked_at, max_reads, read_count, max_writes, write_count, last_access_at, created_by, created_at) ON public.deal_role_profile_share_links TO authenticated;
GRANT ALL ON public.deal_role_profile_share_links TO service_role;
ALTER TABLE public.deal_role_profile_share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY drps_select ON public.deal_role_profile_share_links FOR SELECT TO authenticated
  USING (public.role_profile_can(workspace_id, 'techsales.role_profiles_share.manage.workspace'));

CREATE TABLE public.deal_role_profile_client_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.deal_role_profiles(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES public.deal_role_profile_share_links(id) ON DELETE CASCADE,
  base_revision integer NOT NULL,
  payload jsonb NOT NULL,
  confirmed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deal_role_profile_client_proposals TO authenticated;
GRANT ALL ON public.deal_role_profile_client_proposals TO service_role;
ALTER TABLE public.deal_role_profile_client_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY drpcp_select ON public.deal_role_profile_client_proposals FOR SELECT TO authenticated
  USING (public.role_profile_can(workspace_id, 'techsales.role_profiles.view.workspace')
         AND EXISTS (SELECT 1 FROM public.deal_role_profiles p WHERE p.id = profile_id));

CREATE TABLE public.deal_role_profile_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.deal_role_profiles(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.deal_role_profile_versions(id),
  ats_job_id uuid REFERENCES public.ats_jobs(id) ON DELETE SET NULL,
  early boolean NOT NULL DEFAULT false,
  early_reason text,
  authorized_by uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_synced_version integer NOT NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.deal_role_profile_handoffs TO authenticated;
GRANT ALL ON public.deal_role_profile_handoffs TO service_role;
ALTER TABLE public.deal_role_profile_handoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY drph_select ON public.deal_role_profile_handoffs FOR SELECT TO authenticated
  USING (public.role_profile_can(workspace_id, 'techsales.role_profiles.view.workspace')
         AND EXISTS (SELECT 1 FROM public.deal_role_profiles p WHERE p.id = profile_id));

CREATE TABLE public.deal_role_profile_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  modality text NOT NULL CHECK (modality IN ('outsourcing','hunting','both')),
  seniority text,
  payload jsonb NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.deal_role_profile_templates TO authenticated;
GRANT ALL ON public.deal_role_profile_templates TO service_role;
ALTER TABLE public.deal_role_profile_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY drpt_select ON public.deal_role_profile_templates FOR SELECT TO authenticated
  USING (public.role_profile_can(workspace_id, 'techsales.role_profiles.view.workspace'));
CREATE POLICY drpt_insert ON public.deal_role_profile_templates FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.role_profile_can(workspace_id, 'techsales.role_profiles.create.workspace'));
CREATE POLICY drpt_update ON public.deal_role_profile_templates FOR UPDATE TO authenticated
  USING (public.role_profile_can(workspace_id, 'techsales.role_profiles.update.workspace'))
  WITH CHECK (public.role_profile_can(workspace_id, 'techsales.role_profiles.update.workspace'));

CREATE TABLE public.deal_role_profile_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  content_hash text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('text','url','pdf','docx','image','conversation')),
  source_name text,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','ready','failed','cancelled','confirmed')),
  result jsonb,
  error text,
  profile_id uuid REFERENCES public.deal_role_profiles(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, deal_id, content_hash)
);
GRANT SELECT, INSERT, UPDATE ON public.deal_role_profile_imports TO authenticated;
GRANT ALL ON public.deal_role_profile_imports TO service_role;
ALTER TABLE public.deal_role_profile_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY drpi_select ON public.deal_role_profile_imports FOR SELECT TO authenticated
  USING (created_by = auth.uid() AND public.role_profile_can(workspace_id, 'techsales.role_profiles.create.workspace'));
CREATE POLICY drpi_insert ON public.deal_role_profile_imports FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.role_profile_can(workspace_id, 'techsales.role_profiles.create.workspace')
         AND EXISTS (SELECT 1 FROM public.deals d WHERE d.id = deal_id AND d.workspace_id = deal_role_profile_imports.workspace_id));
CREATE POLICY drpi_update ON public.deal_role_profile_imports FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.role_profile_approve(_profile uuid, _expected_revision integer, _snapshot jsonb, _commercial jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.deal_role_profiles; v_id uuid; v_num integer; v_to text;
BEGIN
  SELECT * INTO p FROM public.deal_role_profiles WHERE id = _profile FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.role_profile_can(p.workspace_id, 'techsales.role_profiles.approve.workspace') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: techsales.role_profiles.approve.workspace' USING ERRCODE = '42501';
  END IF;
  IF p.revision <> _expected_revision THEN
    RAISE EXCEPTION 'STALE_REVISION: o perfil foi alterado (revisão %); recarregue antes de aprovar', p.revision USING ERRCODE = '40001';
  END IF;
  IF p.status NOT IN ('in_validation','awaiting_info','draft') THEN
    RAISE EXCEPTION 'Status % não permite aprovação', p.status;
  END IF;
  v_num := p.last_version + 1;
  v_to := CASE WHEN p.ats_job_id IS NOT NULL THEN 'forwarded' ELSE 'approved' END;
  INSERT INTO public.deal_role_profile_versions(profile_id, workspace_id, version, snapshot, commercial_snapshot, approved_by)
    VALUES (p.id, p.workspace_id, v_num, _snapshot,
            CASE WHEN public.role_profile_can(p.workspace_id, 'techsales.role_profiles_commercial.view.workspace') THEN _commercial ELSE NULL END,
            auth.uid())
    RETURNING id INTO v_id;
  UPDATE public.deal_role_profiles
     SET status = v_to, approved_version_id = v_id, last_version = v_num, revision = revision + 1, updated_at = now()
   WHERE id = p.id;
  INSERT INTO public.deal_role_profile_events(profile_id, workspace_id, kind, from_status, to_status, version, actor_id)
    VALUES (p.id, p.workspace_id, 'approved', p.status, v_to, v_num, auth.uid());
  RETURN jsonb_build_object('version_id', v_id, 'version', v_num);
END $$;
REVOKE ALL ON FUNCTION public.role_profile_approve(uuid, integer, jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.role_profile_approve(uuid, integer, jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.role_profile_forward(_profile uuid, _job jsonb, _early boolean, _early_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.deal_role_profiles; h public.deal_role_profile_handoffs; d public.deals;
        v public.deal_role_profile_versions; pipe uuid; job uuid; won boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('role_profile_forward:' || _profile::text));
  SELECT * INTO p FROM public.deal_role_profiles WHERE id = _profile FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF NOT public.role_profile_can(p.workspace_id, 'techsales.role_profiles.manage.workspace') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: techsales.role_profiles.manage.workspace' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO h FROM public.deal_role_profile_handoffs WHERE profile_id = p.id;
  IF FOUND THEN
    RETURN jsonb_build_object('ats_job_id', h.ats_job_id, 'already', true);
  END IF;
  IF p.approved_version_id IS NULL OR p.status <> 'approved' THEN
    RAISE EXCEPTION 'Aprove a versão atual antes de encaminhar ao recrutamento';
  END IF;
  SELECT * INTO d FROM public.deals WHERE id = p.deal_id AND workspace_id = p.workspace_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Negócio não encontrado'; END IF;
  SELECT * INTO v FROM public.deal_role_profile_versions WHERE id = p.approved_version_id;
  won := (d.stage::text = 'won' OR coalesce(d.stage_id,'') ILIKE '%won%');
  IF NOT won THEN
    IF NOT coalesce(_early, false) THEN
      RAISE EXCEPTION 'EARLY_REQUIRED: o negócio ainda não foi ganho; é preciso autorização comercial antecipada';
    END IF;
    IF NOT public.role_profile_can(p.workspace_id, 'techsales.role_profiles_early.approve.workspace') THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: techsales.role_profiles_early.approve.workspace' USING ERRCODE = '42501';
    END IF;
    IF char_length(coalesce(trim(_early_reason), '')) < 10 THEN
      RAISE EXCEPTION 'Informe o motivo da autorização antecipada (mínimo 10 caracteres)';
    END IF;
  END IF;
  SELECT id INTO pipe FROM public.ats_pipelines WHERE workspace_id = p.workspace_id
    ORDER BY is_default DESC, created_at ASC LIMIT 1;
  IF pipe IS NULL THEN RAISE EXCEPTION 'Configure um pipeline no TechHire antes de encaminhar'; END IF;
  INSERT INTO public.ats_jobs(owner_id, workspace_id, pipeline_id, title, slug, description, requirements,
                              seniority, employment_type, location, remote_mode, salary_min, salary_max,
                              salary_currency, status, deal_id, company_id, assigned_to, metadata)
  VALUES (auth.uid(), p.workspace_id, pipe, left(_job->>'title', 200),
          trim(both '-' from left(regexp_replace(lower(_job->>'title'), '[^a-z0-9]+', '-', 'g'), 60)) || '-' || substr(md5(p.id::text || clock_timestamp()::text), 1, 8),
          _job->>'description', _job->>'requirements', _job->>'seniority', _job->>'employment_type',
          _job->>'location', _job->>'remote_mode', nullif(_job->>'salary_min','')::numeric, nullif(_job->>'salary_max','')::numeric,
          _job->>'salary_currency', 'draft', p.deal_id, p.company_id, auth.uid(),
          jsonb_build_object('source','deal_role_profile','role_profile_id',p.id,'role_profile_version',v.version,
                             'quantity',p.quantity,'modality',p.modality,'contact_id',p.contact_id))
  RETURNING id INTO job;
  INSERT INTO public.deal_role_profile_handoffs(profile_id, workspace_id, version_id, ats_job_id, early, early_reason, authorized_by, created_by, last_synced_version)
    VALUES (p.id, p.workspace_id, v.id, job, NOT won, CASE WHEN won THEN NULL ELSE _early_reason END,
            CASE WHEN won THEN NULL ELSE auth.uid() END, auth.uid(), v.version);
  UPDATE public.deal_role_profiles SET status = 'forwarded', ats_job_id = job, ats_synced_version = v.version,
         revision = revision + 1, updated_at = now() WHERE id = p.id;
  INSERT INTO public.deal_role_profile_events(profile_id, workspace_id, kind, from_status, to_status, version, reason, details, actor_id)
    VALUES (p.id, p.workspace_id, CASE WHEN won THEN 'forwarded' ELSE 'forwarded_early' END, p.status, 'forwarded', v.version,
            CASE WHEN won THEN NULL ELSE _early_reason END, jsonb_build_object('ats_job_id', job), auth.uid());
  RETURN jsonb_build_object('ats_job_id', job, 'already', false);
END $$;
REVOKE ALL ON FUNCTION public.role_profile_forward(uuid, jsonb, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.role_profile_forward(uuid, jsonb, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.role_profile_sync_ats(_profile uuid, _job jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.deal_role_profiles; v public.deal_role_profile_versions;
BEGIN
  SELECT * INTO p FROM public.deal_role_profiles WHERE id = _profile FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;
  IF NOT public.role_profile_can(p.workspace_id, 'techsales.role_profiles.manage.workspace') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: techsales.role_profiles.manage.workspace' USING ERRCODE = '42501';
  END IF;
  IF p.ats_job_id IS NULL THEN RAISE EXCEPTION 'Perfil ainda não foi encaminhado'; END IF;
  IF p.status <> 'forwarded' OR p.approved_version_id IS NULL THEN
    RAISE EXCEPTION 'Aprove a nova versão antes de sincronizar com o TechHire';
  END IF;
  SELECT * INTO v FROM public.deal_role_profile_versions WHERE id = p.approved_version_id;
  IF p.ats_synced_version = v.version THEN RETURN jsonb_build_object('already', true, 'version', v.version); END IF;
  UPDATE public.ats_jobs SET title = left(_job->>'title',200), description = _job->>'description',
         requirements = _job->>'requirements', seniority = _job->>'seniority', employment_type = _job->>'employment_type',
         location = _job->>'location', remote_mode = _job->>'remote_mode',
         salary_min = nullif(_job->>'salary_min','')::numeric, salary_max = nullif(_job->>'salary_max','')::numeric,
         salary_currency = _job->>'salary_currency',
         metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('role_profile_version', v.version, 'quantity', p.quantity),
         updated_at = now()
   WHERE id = p.ats_job_id AND workspace_id = p.workspace_id;
  UPDATE public.deal_role_profile_handoffs SET last_synced_version = v.version, last_synced_at = now(), version_id = v.id WHERE profile_id = p.id;
  UPDATE public.deal_role_profiles SET ats_synced_version = v.version, updated_at = now() WHERE id = p.id;
  INSERT INTO public.deal_role_profile_events(profile_id, workspace_id, kind, version, details, actor_id)
    VALUES (p.id, p.workspace_id, 'ats_synced', v.version, jsonb_build_object('ats_job_id', p.ats_job_id), auth.uid());
  RETURN jsonb_build_object('already', false, 'version', v.version);
END $$;
REVOKE ALL ON FUNCTION public.role_profile_sync_ats(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.role_profile_sync_ats(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.role_profile_version_commercial(_version uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.commercial_snapshot FROM public.deal_role_profile_versions v
   WHERE v.id = _version
     AND public.role_profile_can(v.workspace_id, 'techsales.role_profiles_commercial.view.workspace');
$$;
REVOKE ALL ON FUNCTION public.role_profile_version_commercial(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.role_profile_version_commercial(uuid) TO authenticated;
