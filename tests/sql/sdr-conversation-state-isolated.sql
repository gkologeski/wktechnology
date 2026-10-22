-- Prova isolada do estado explícito da conversa do Agente SDR (0184):
-- compare-and-set por versão, merge sem perda, isolamento por workspace e
-- nenhuma escrita parcial quando o CAS falha. Só roda no banco descartável.
\set ON_ERROR_STOP on
\set wa 'aaaaaaaa-0000-4000-8000-00000000000a'
\set wb 'aaaaaaaa-0000-4000-8000-00000000000b'
\set u1 '10000000-0000-4000-8000-000000000001'
\set lease '7a000000-0000-4000-8000-000000000001'
select label from public.__isolated_marker where id = 1;

insert into public.whatsapp_conversations (id, workspace_id, owner_id, contact_phone, twilio_number, ai_owner, ai_version)
values ('7c000000-0000-4000-8000-000000000001', :'wa', :'u1', '+5548900000001', 'iso', 'ai', 1);
insert into public.sdr_playbooks (id, workspace_id, owner_id, name)
values ('7b000000-0000-4000-8000-000000000001', :'wa', :'u1', '[ISO] Agente');
insert into public.sdr_enrollments (id, workspace_id, owner_id, playbook_id, conversation_id, status)
values ('7e000000-0000-4000-8000-000000000001', :'wa', :'u1', '7b000000-0000-4000-8000-000000000001', '7c000000-0000-4000-8000-000000000001', 'active');
insert into public.sdr_turn_jobs (id, workspace_id, enrollment_id, conversation_id, kind, idem_key, status, lease_token, lease_until, conversation_version)
values ('7f000000-0000-4000-8000-000000000001', :'wa', '7e000000-0000-4000-8000-000000000001', '7c000000-0000-4000-8000-000000000001',
        'follow_up', 'iso:state:1', 'running', :'lease', now() + interval '10 min', 1);

do $$
declare r text; e record;
begin
  select conversation_state, conversation_state_version into e from public.sdr_enrollments where id = '7e000000-0000-4000-8000-000000000001';
  if e.conversation_state <> '{}'::jsonb or e.conversation_state_version <> 0 then raise exception 'FALHOU: padrão do estado'; end if;
  raise notice 'ok: estado nasce vazio na versão 0';

  r := public.sdr_commit_turn('7f000000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-000000000001', '[]', null,
    '{"conversation_state":{"referral_asked":{"at":"t1","job_id":"j1"}},"expected_state_version":0}', null);
  select conversation_state, conversation_state_version into e from public.sdr_enrollments where id = '7e000000-0000-4000-8000-000000000001';
  if r <> 'ok' or e.conversation_state_version <> 1 or e.conversation_state->'referral_asked'->>'job_id' <> 'j1' then
    raise exception 'FALHOU: primeiro commit (%)', r; end if;
  raise notice 'ok: commit com versão esperada grava e incrementa';

  r := public.sdr_commit_turn('7f000000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-000000000001', '[]', null,
    '{"offers":["iso"],"conversation_state":{"closed":{"reason":"other"}},"expected_state_version":0}', null);
  select * into e from public.sdr_enrollments where id = '7e000000-0000-4000-8000-000000000001';
  if r <> 'state_changed' or e.conversation_state ? 'closed' or e.offers ? 'iso' or e.conversation_state_version <> 1 then
    raise exception 'FALHOU: CAS obsoleto escreveu algo (%)', r; end if;
  raise notice 'ok: versão obsoleta devolve state_changed sem escrita parcial';

  r := public.sdr_commit_turn('7f000000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-000000000001', '[]', null,
    '{"conversation_state":{"closed":{"reason":"no_demand","job_id":"j2"}},"expected_state_version":1}', null);
  select * into e from public.sdr_enrollments where id = '7e000000-0000-4000-8000-000000000001';
  if r <> 'ok' or not (e.conversation_state ? 'referral_asked') or e.conversation_state->'closed'->>'reason' <> 'no_demand' or e.conversation_state_version <> 2 then
    raise exception 'FALHOU: merge (%)', r; end if;
  raise notice 'ok: merge preserva itens anteriores';

  r := public.sdr_commit_turn('7f000000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-000000000001', '[]', null,
    '{"conversation_state":{"closed":null},"expected_state_version":2}', null);
  select * into e from public.sdr_enrollments where id = '7e000000-0000-4000-8000-000000000001';
  if r <> 'ok' or e.conversation_state->'closed' <> 'null'::jsonb then raise exception 'FALHOU: reabertura (%)', r; end if;
  raise notice 'ok: reabertura explícita grava closed=null';

  r := public.sdr_commit_turn('7f000000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-000000000001', '[]', null,
    '{"offers":["sem_estado"]}', null);
  select * into e from public.sdr_enrollments where id = '7e000000-0000-4000-8000-000000000001';
  if r <> 'ok' or e.conversation_state_version <> 3 then raise exception 'FALHOU: commit sem estado mudou a versão'; end if;
  raise notice 'ok: commit sem estado não mexe na versão';

  r := public.sdr_commit_turn('7f000000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-0000000000ff', '[]', null,
    '{"conversation_state":{"x":1},"expected_state_version":3}', null);
  if r <> 'lease_lost' then raise exception 'FALHOU: lease alheio aceito (%)', r; end if;
  raise notice 'ok: lease alheio recusado antes do estado';
end $$;

-- Outro workspace: trabalho do tenant B apontando para conversa do tenant A.
insert into public.sdr_turn_jobs (id, workspace_id, enrollment_id, conversation_id, kind, idem_key, status, lease_token, lease_until, conversation_version)
values ('7f000000-0000-4000-8000-000000000002', :'wb', '7e000000-0000-4000-8000-000000000001', '7c000000-0000-4000-8000-000000000001',
        'follow_up', 'iso:state:2', 'running', :'lease', now() + interval '10 min', 1);
do $$
declare r text; v int;
begin
  r := public.sdr_commit_turn('7f000000-0000-4000-8000-000000000002', '7a000000-0000-4000-8000-000000000001', '[]', null,
    '{"conversation_state":{"closed":{"reason":"other"}},"expected_state_version":3}', null);
  select conversation_state_version into v from public.sdr_enrollments where id = '7e000000-0000-4000-8000-000000000001';
  if r <> 'context_mismatch' or v <> 3 then raise exception 'FALHOU: outro workspace (%)', r; end if;
  raise notice 'ok: trabalho de outro workspace não grava estado';
end $$;
select 'concurrency-point' as marker;
