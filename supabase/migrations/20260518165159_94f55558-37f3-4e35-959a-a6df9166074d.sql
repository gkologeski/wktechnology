
create table if not exists public.whatsapp_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  body_template text,
  template_name text,
  content_sid text,
  content_variables_template jsonb not null default '{}'::jsonb,
  media_url text,
  media_content_type text,
  rate_per_minute integer not null default 10,
  status text not null default 'draft',
  total integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  last_tick_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.whatsapp_campaigns enable row level security;
create policy "campaigns owner all" on public.whatsapp_campaigns
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create index if not exists whatsapp_campaigns_owner_idx on public.whatsapp_campaigns(owner_id, created_at desc);
create index if not exists whatsapp_campaigns_status_idx on public.whatsapp_campaigns(status, scheduled_at);

create table if not exists public.whatsapp_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.whatsapp_campaigns(id) on delete cascade,
  owner_id uuid not null,
  contact_id uuid,
  phone text not null,
  variables jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  twilio_sid text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.whatsapp_campaign_recipients enable row level security;
create policy "campaign recipients owner all" on public.whatsapp_campaign_recipients
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create index if not exists whatsapp_campaign_recipients_campaign_idx on public.whatsapp_campaign_recipients(campaign_id, status);

create trigger trg_whatsapp_campaigns_updated_at
  before update on public.whatsapp_campaigns
  for each row execute function public.set_updated_at();
