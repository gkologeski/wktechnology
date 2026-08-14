update public.workflows
set trigger = '{"event":"stage_changed","filters":[{"field":"stage_id","op":"changed_to","value":"qualifying"}],"reenroll":{"enabled":false,"events":[]}}'::jsonb,
    updated_at = now()
where name = 'Pesquisa de qualificação ao entrar em Em qualificação';