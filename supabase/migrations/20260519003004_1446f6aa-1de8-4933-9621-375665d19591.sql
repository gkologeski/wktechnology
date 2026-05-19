
-- 1.2 Templates + snippets
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  subject text,
  body_html text,
  body_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_templates_owner ON public.email_templates FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.email_snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  shortcut text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, shortcut)
);
ALTER TABLE public.email_snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_snippets_owner ON public.email_snippets FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER email_snippets_updated_at BEFORE UPDATE ON public.email_snippets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 1.4 Task queues
CREATE TABLE public.task_queues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_queues ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_queues_owner ON public.task_queues FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER task_queues_updated_at BEFORE UPDATE ON public.task_queues FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.task_queue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid NOT NULL REFERENCES public.task_queues(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  position integer NOT NULL DEFAULT 0,
  activity_id uuid,
  contact_id uuid,
  lead_id uuid,
  deal_id uuid,
  completed_at timestamptz,
  skipped_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX task_queue_items_queue_idx ON public.task_queue_items (queue_id, position);
ALTER TABLE public.task_queue_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_queue_items_owner ON public.task_queue_items FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- 1.5 Notes mentions + attachments
ALTER TABLE public.activities
  ADD COLUMN mentions uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Bucket privado para anexos de notas
INSERT INTO storage.buckets (id, name, public) VALUES ('notes-attachments', 'notes-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "notes_attachments_owner_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'notes-attachments' AND owner = auth.uid());
CREATE POLICY "notes_attachments_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'notes-attachments' AND owner = auth.uid());
CREATE POLICY "notes_attachments_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'notes-attachments' AND owner = auth.uid());
