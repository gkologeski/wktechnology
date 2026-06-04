UPDATE public.tickets t
   SET pipeline_id = p.id
  FROM public.pipelines p
 WHERE p.entity = 'ticket'
   AND p.workspace_id = t.workspace_id
   AND p.config->>'hubspot_id' = (t.external_ids->>'hs_pipeline')
   AND t.pipeline_id IS NULL
   AND t.external_ids->>'hs_pipeline' IS NOT NULL;