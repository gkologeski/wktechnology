CREATE TABLE public.inbox_ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('company_left')),
  target_entity text NOT NULL CHECK (target_entity IN ('contact','lead')),
  target_id uuid NOT NULL,
  old_company_id uuid,
  old_company_name text,
  new_company_name text,
  matched_company_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','dismissed')),
  applied_company_id uuid,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, kind)
);
GRANT SELECT ON public.inbox_ai_suggestions TO authenticated;
GRANT ALL ON public.inbox_ai_suggestions TO service_role;
ALTER TABLE public.inbox_ai_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inbox_ai_suggestions_select_visible_conversation" ON public.inbox_ai_suggestions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.whatsapp_conversations w
    WHERE w.id = conversation_id AND w.workspace_id = inbox_ai_suggestions.workspace_id));
CREATE INDEX inbox_ai_suggestions_conv_idx ON public.inbox_ai_suggestions (conversation_id, created_at);