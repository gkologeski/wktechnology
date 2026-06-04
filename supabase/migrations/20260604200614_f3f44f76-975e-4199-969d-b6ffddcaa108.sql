-- Backfill pipeline_id dos tickets a partir de custom_fields->>hs_pipeline
UPDATE public.tickets t
   SET pipeline_id = p.id
  FROM public.pipelines p
 WHERE p.entity = 'ticket'
   AND p.workspace_id = t.workspace_id
   AND p.config->>'hubspot_id' = (t.custom_fields->>'hs_pipeline')
   AND t.pipeline_id IS NULL
   AND t.custom_fields->>'hs_pipeline' IS NOT NULL;

-- Remover o pipeline default vazio (sem hubspot_id no config) se houver outros
DELETE FROM public.pipelines
 WHERE entity = 'ticket'
   AND (config IS NULL OR config->>'hubspot_id' IS NULL)
   AND NOT EXISTS (
     SELECT 1 FROM public.tickets t WHERE t.pipeline_id = pipelines.id
   );