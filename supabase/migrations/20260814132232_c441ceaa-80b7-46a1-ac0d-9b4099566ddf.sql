insert into public.workflows (owner_id, workspace_id, name, entity, trigger, actions, enabled, status, published_version, last_published_at)
values (
  '1c237fbe-079e-4eb9-a3e6-c08d85e79688',
  '184b9435-0a9b-4334-9e89-8854dc883f5d',
  'Pesquisa de qualificação ao entrar em Em qualificação',
  'leads',
  '{"event":"stage_changed","filters":[{"field":"stage","op":"changed_to","value":"qualifying"}],"reenroll":{"enabled":false,"events":[]}}'::jsonb,
  '[{"type":"create_survey_activity","source":"prospecting_questionnaire","source_id":"a117e6fe-82fd-44c7-b621-627beb92457c","subject":"Qualificação do lead"}]'::jsonb,
  true,
  'published',
  1,
  now()
);