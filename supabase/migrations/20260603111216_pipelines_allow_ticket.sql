ALTER TABLE public.pipelines DROP CONSTRAINT IF EXISTS pipelines_entity_check;
ALTER TABLE public.pipelines ADD CONSTRAINT pipelines_entity_check
  CHECK (entity = ANY (ARRAY['deal','lead','deals','leads','ticket','tickets']));
