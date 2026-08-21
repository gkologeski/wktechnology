delete from public.activities where related_lead_id in ('49ee95b4-f44b-4628-96f1-d26a368743bb','52efc6d0-87dc-47fd-80a9-0ddf234e9194');
delete from public.meetings where id in ('22136792-f901-460b-86ab-b6e8c45090f3','01d29de0-b7a9-4e8a-bce5-48087a4d92a1');
delete from public.deal_contacts where deal_id in ('6d31c5b9-967d-4f7e-959e-400220bdc19c','cf08033c-d7b4-4df6-8fa5-2f4bd47f58ad');
delete from public.deals where id in ('6d31c5b9-967d-4f7e-959e-400220bdc19c','cf08033c-d7b4-4df6-8fa5-2f4bd47f58ad');
delete from public.leads where id in ('49ee95b4-f44b-4628-96f1-d26a368743bb','52efc6d0-87dc-47fd-80a9-0ddf234e9194');
delete from public.contacts where email in ('qa.contato@example.com','qa.apiv1@example.com','qa2.apiv1@example.com');
delete from public.companies where id = 'c66ea459-c1bc-4c4b-928f-33cfe68fb50e';
update public.api_keys set revoked_at = now() where name in ('qa-api-v1-rw','qa-api-v1-ro');