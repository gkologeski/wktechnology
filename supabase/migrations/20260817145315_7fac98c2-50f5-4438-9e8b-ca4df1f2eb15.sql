INSERT INTO public.workflows (
  owner_id, workspace_id, name, entity, trigger, actions, enabled, status, published_version, last_published_at
)
SELECT
  '1c237fbe-079e-4eb9-a3e6-c08d85e79688'::uuid,
  '184b9435-0a9b-4334-9e89-8854dc883f5d'::uuid,
  'Abrir criação de oportunidade ao entrar em Oportunidade',
  'leads',
  '{"event":"stage_changed","filters":[{"field":"stage_id","op":"changed_to","value":"oportunity"}],"reenroll":{"enabled":false,"events":[]}}'::jsonb,
  '[{"type":"open_deal_dialog","pipeline_id":"33399bd1-0697-4a17-8e9a-f7526ac39fb8","due_rule":"last_business_day_of_month","subject":"Criar oportunidade"}]'::jsonb,
  true,
  'published',
  1,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.workflows w
  WHERE w.workspace_id = '184b9435-0a9b-4334-9e89-8854dc883f5d'::uuid
    AND w.entity = 'leads'
    AND w.actions::text LIKE '%open_deal_dialog%'
);