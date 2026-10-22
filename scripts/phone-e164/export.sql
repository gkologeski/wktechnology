-- Exporta os telefones do workspace alvo (:ws) como JSON por linha para
-- `classify.ts`. Só leitura. Perfis entram apenas quando o usuário pertence
-- SOMENTE a este workspace (perfil é global; nunca reescrever de outro tenant).
\set QUIET on
\pset tuples_only on
\pset format unaligned
select json_build_object('t','contacts','c',x.c,'id',id,'v',x.v,'country',country)::text
  from public.contacts, lateral (values ('phone',phone),('mobile_phone',mobile_phone)) x(c,v)
 where workspace_id = :'ws' and x.v is not null and btrim(x.v) <> '';
select json_build_object('t','leads','c',x.c,'id',id,'v',x.v,'deleted',deleted_at is not null)::text
  from public.leads, lateral (values ('phone',phone),('mobile_phone',mobile_phone)) x(c,v)
 where workspace_id = :'ws' and x.v is not null and btrim(x.v) <> '';
select json_build_object('t','companies','c','phone','id',id,'v',phone,'country',country)::text
  from public.companies where workspace_id = :'ws' and phone is not null and btrim(phone) <> '';
select json_build_object('t','people','c',x.c,'id',id,'v',x.v)::text
  from public.people, lateral (values ('phone',phone),('emergency_phone',emergency_phone)) x(c,v)
 where workspace_id = :'ws' and x.v is not null and btrim(x.v) <> '';
select json_build_object('t','ats_candidates','c','phone','id',id,'v',phone)::text
  from public.ats_candidates where workspace_id = :'ws' and phone is not null and btrim(phone) <> '';
select json_build_object('t','ats_referrals','c','candidate_phone','id',id,'v',candidate_phone)::text
  from public.ats_referrals where workspace_id = :'ws' and candidate_phone is not null and btrim(candidate_phone) <> '';
select json_build_object('t','bookings','c','invitee_phone','id',id,'v',invitee_phone)::text
  from public.bookings where workspace_id = :'ws' and invitee_phone is not null and btrim(invitee_phone) <> '';
select json_build_object('t','prospecting_results','c',x.c,'id',id,'v',x.v)::text
  from public.prospecting_results, lateral (values ('phone',phone),('company_phone',company_phone)) x(c,v)
 where workspace_id = :'ws' and x.v is not null and btrim(x.v) <> '';
select json_build_object('t','profiles','c','phone','id',p.id,'v',p.phone)::text
  from public.profiles p
 where p.phone is not null and btrim(p.phone) <> ''
   and exists (select 1 from public.workspace_members m where m.user_id = p.id and m.workspace_id = :'ws')
   and not exists (select 1 from public.workspace_members m where m.user_id = p.id and m.workspace_id <> :'ws');
