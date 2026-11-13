-- Match the unchanged owner/type/date/order query in pushPendingMeetings.
-- Existing task/open-meeting indexes exclude rows that this query still reads.
CREATE INDEX IF NOT EXISTS activities_meetings_owner_due_idx
  ON public.activities(owner_id,due_date)
  WHERE type='meeting' AND due_date IS NOT NULL;
-- This is the existing protected surface; no RLS policy or grant is changed.
COMMENT ON TABLE public.activities IS 'Atividades comerciais; acesso por workspace, membership ativo e permissões efetivas nas políticas RLS existentes.';
