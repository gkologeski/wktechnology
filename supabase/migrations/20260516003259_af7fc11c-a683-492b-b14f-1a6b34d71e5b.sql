
-- Cobertura completa de propriedades HubSpot

-- companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS hs_raw jsonb,
  ADD COLUMN IF NOT EXISTS annualrevenue numeric,
  ADD COLUMN IF NOT EXISTS lifecyclestage text,
  ADD COLUMN IF NOT EXISTS hs_lead_status text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS hubspot_owner_id text,
  ADD COLUMN IF NOT EXISTS hs_object_id text,
  ADD COLUMN IF NOT EXISTS hs_createdate timestamptz,
  ADD COLUMN IF NOT EXISTS hs_lastmodifieddate timestamptz,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS linkedin_company_page text,
  ADD COLUMN IF NOT EXISTS twitterhandle text,
  ADD COLUMN IF NOT EXISTS facebook_company_page text;
CREATE INDEX IF NOT EXISTS companies_hs_raw_gin ON public.companies USING GIN (hs_raw);
CREATE INDEX IF NOT EXISTS companies_hs_object_id_idx ON public.companies (hs_object_id);
CREATE INDEX IF NOT EXISTS companies_hubspot_owner_id_idx ON public.companies (hubspot_owner_id);

-- contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS hs_raw jsonb,
  ADD COLUMN IF NOT EXISTS mobile_phone text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS lifecyclestage text,
  ADD COLUMN IF NOT EXISTS hs_lead_status text,
  ADD COLUMN IF NOT EXISTS hubspot_owner_id text,
  ADD COLUMN IF NOT EXISTS hs_object_id text,
  ADD COLUMN IF NOT EXISTS hs_createdate timestamptz,
  ADD COLUMN IF NOT EXISTS hs_lastmodifieddate timestamptz,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS twitter_handle text;
CREATE INDEX IF NOT EXISTS contacts_hs_raw_gin ON public.contacts USING GIN (hs_raw);
CREATE INDEX IF NOT EXISTS contacts_hs_object_id_idx ON public.contacts (hs_object_id);
CREATE INDEX IF NOT EXISTS contacts_hubspot_owner_id_idx ON public.contacts (hubspot_owner_id);

-- deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS hs_raw jsonb,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS dealtype text,
  ADD COLUMN IF NOT EXISTS hs_priority text,
  ADD COLUMN IF NOT EXISTS hs_deal_stage_probability numeric,
  ADD COLUMN IF NOT EXISTS hubspot_owner_id text,
  ADD COLUMN IF NOT EXISTS hs_object_id text,
  ADD COLUMN IF NOT EXISTS hs_createdate timestamptz,
  ADD COLUMN IF NOT EXISTS hs_lastmodifieddate timestamptz,
  ADD COLUMN IF NOT EXISTS closed_lost_reason text,
  ADD COLUMN IF NOT EXISTS closed_won_reason text,
  ADD COLUMN IF NOT EXISTS num_associated_contacts integer;
CREATE INDEX IF NOT EXISTS deals_hs_raw_gin ON public.deals USING GIN (hs_raw);
CREATE INDEX IF NOT EXISTS deals_hs_object_id_idx ON public.deals (hs_object_id);
CREATE INDEX IF NOT EXISTS deals_hubspot_owner_id_idx ON public.deals (hubspot_owner_id);

-- leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS hs_raw jsonb,
  ADD COLUMN IF NOT EXISTS hubspot_owner_id text,
  ADD COLUMN IF NOT EXISTS hs_object_id text,
  ADD COLUMN IF NOT EXISTS hs_createdate timestamptz,
  ADD COLUMN IF NOT EXISTS hs_lastmodifieddate timestamptz,
  ADD COLUMN IF NOT EXISTS hs_lead_source_detail text;
CREATE INDEX IF NOT EXISTS leads_hs_raw_gin ON public.leads USING GIN (hs_raw);
CREATE INDEX IF NOT EXISTS leads_hs_object_id_idx ON public.leads (hs_object_id);

-- activities
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS hs_raw jsonb,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS disposition text,
  ADD COLUMN IF NOT EXISTS recording_url text,
  ADD COLUMN IF NOT EXISTS meeting_outcome text,
  ADD COLUMN IF NOT EXISTS meeting_location text,
  ADD COLUMN IF NOT EXISTS task_status text,
  ADD COLUMN IF NOT EXISTS task_priority text,
  ADD COLUMN IF NOT EXISTS email_direction text,
  ADD COLUMN IF NOT EXISTS email_status text,
  ADD COLUMN IF NOT EXISTS hubspot_owner_id text,
  ADD COLUMN IF NOT EXISTS hs_object_id text,
  ADD COLUMN IF NOT EXISTS hs_createdate timestamptz,
  ADD COLUMN IF NOT EXISTS hs_lastmodifieddate timestamptz;
CREATE INDEX IF NOT EXISTS activities_hs_raw_gin ON public.activities USING GIN (hs_raw);
CREATE INDEX IF NOT EXISTS activities_hs_object_id_idx ON public.activities (hs_object_id);
