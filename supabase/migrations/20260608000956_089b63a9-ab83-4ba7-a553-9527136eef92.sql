CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  host_user_id UUID,
  title TEXT NOT NULL DEFAULT 'Reunião',
  provider TEXT NOT NULL DEFAULT 'jitsi' CHECK (provider IN ('jitsi')),
  room_name TEXT NOT NULL,
  public_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  recording_consent BOOLEAN NOT NULL DEFAULT false,
  recording_storage_path TEXT,
  recording_mime_type TEXT,
  recording_duration_seconds INTEGER,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  related_contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  related_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  related_deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  related_ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meetings TO authenticated;
GRANT ALL ON public.meetings TO service_role;

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view meetings"
ON public.meetings
FOR SELECT
TO authenticated
USING (owner_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "Workspace members can create meetings"
ON public.meetings
FOR INSERT
TO authenticated
WITH CHECK (owner_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "Workspace members can update meetings"
ON public.meetings
FOR UPDATE
TO authenticated
USING (owner_id IN (SELECT public.current_user_workspaces()))
WITH CHECK (owner_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "Workspace members can delete meetings"
ON public.meetings
FOR DELETE
TO authenticated
USING (owner_id IN (SELECT public.current_user_workspaces()));

CREATE INDEX IF NOT EXISTS meetings_owner_id_idx ON public.meetings(owner_id);
CREATE INDEX IF NOT EXISTS meetings_public_token_idx ON public.meetings(public_token);
CREATE INDEX IF NOT EXISTS meetings_status_idx ON public.meetings(owner_id, status);
CREATE INDEX IF NOT EXISTS meetings_created_at_idx ON public.meetings(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS meetings_related_contact_id_idx ON public.meetings(related_contact_id);
CREATE INDEX IF NOT EXISTS meetings_related_lead_id_idx ON public.meetings(related_lead_id);
CREATE INDEX IF NOT EXISTS meetings_related_deal_id_idx ON public.meetings(related_deal_id);
CREATE INDEX IF NOT EXISTS meetings_related_ticket_id_idx ON public.meetings(related_ticket_id);

CREATE TRIGGER meetings_set_updated_at
BEFORE UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.meeting_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id UUID,
  display_name TEXT NOT NULL,
  email TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_participants TO authenticated;
GRANT ALL ON public.meeting_participants TO service_role;

ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view meeting participants"
ON public.meeting_participants
FOR SELECT
TO authenticated
USING (owner_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "Workspace members can create meeting participants"
ON public.meeting_participants
FOR INSERT
TO authenticated
WITH CHECK (owner_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "Workspace members can update meeting participants"
ON public.meeting_participants
FOR UPDATE
TO authenticated
USING (owner_id IN (SELECT public.current_user_workspaces()))
WITH CHECK (owner_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "Workspace members can delete meeting participants"
ON public.meeting_participants
FOR DELETE
TO authenticated
USING (owner_id IN (SELECT public.current_user_workspaces()));

CREATE INDEX IF NOT EXISTS meeting_participants_owner_id_idx ON public.meeting_participants(owner_id);
CREATE INDEX IF NOT EXISTS meeting_participants_meeting_id_idx ON public.meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS meeting_participants_user_id_idx ON public.meeting_participants(user_id);

CREATE TRIGGER meeting_participants_set_updated_at
BEFORE UPDATE ON public.meeting_participants
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.meeting_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL UNIQUE REFERENCES public.meetings(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  transcript TEXT,
  summary TEXT,
  decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  sentiment TEXT CHECK (sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative')),
  model TEXT,
  error_message TEXT,
  transcript_search TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('portuguese', coalesce(transcript, '') || ' ' || coalesce(summary, ''))
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_summaries TO authenticated;
GRANT ALL ON public.meeting_summaries TO service_role;

ALTER TABLE public.meeting_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view meeting summaries"
ON public.meeting_summaries
FOR SELECT
TO authenticated
USING (owner_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "Workspace members can create meeting summaries"
ON public.meeting_summaries
FOR INSERT
TO authenticated
WITH CHECK (owner_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "Workspace members can update meeting summaries"
ON public.meeting_summaries
FOR UPDATE
TO authenticated
USING (owner_id IN (SELECT public.current_user_workspaces()))
WITH CHECK (owner_id IN (SELECT public.current_user_workspaces()));

CREATE POLICY "Workspace members can delete meeting summaries"
ON public.meeting_summaries
FOR DELETE
TO authenticated
USING (owner_id IN (SELECT public.current_user_workspaces()));

CREATE INDEX IF NOT EXISTS meeting_summaries_owner_id_idx ON public.meeting_summaries(owner_id);
CREATE INDEX IF NOT EXISTS meeting_summaries_meeting_id_idx ON public.meeting_summaries(meeting_id);
CREATE INDEX IF NOT EXISTS meeting_summaries_transcript_search_idx ON public.meeting_summaries USING GIN(transcript_search);

CREATE TRIGGER meeting_summaries_set_updated_at
BEFORE UPDATE ON public.meeting_summaries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS meeting_settings JSONB NOT NULL DEFAULT '{"provider":"jitsi","require_consent":true,"retention_days":90,"transcription_model":"google/gemini-2.5-flash"}'::jsonb;