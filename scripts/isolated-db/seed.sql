-- Fixtures SINTÉTICAS do banco isolado. Idempotente (ON CONFLICT DO NOTHING); ids fixos
-- com prefixo reconhecível; e-mails .invalid; telefones de faixa fictícia. Só roda após iso_guard.
\set ON_ERROR_STOP 1
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.__isolated_marker WHERE id = 1 AND label = 'techerp-isolated-harness') THEN
    RAISE EXCEPTION 'seed recusado: banco sem marcador do harness';
  END IF;
END $$;

\copy public.permissions (key,module,resource,action,scope,label_pt,description,is_system) from '/tmp/techerp-isolated/ref-permissions.csv' with csv
\copy public.modules (id,name,host_suffix,default_color,default_product_name,icon,sort_order) from '/tmp/techerp-isolated/ref-modules.csv' with csv

-- Usuários: 1 admin A | 2 próprio A | 3 equipe A | 4 workspace A | 5 removido A | 6 admin B | 7 par A
INSERT INTO auth.users (id, email, aud, role, email_confirmed_at, raw_user_meta_data) VALUES
 ('10000000-0000-4000-8000-000000000001','admin-a@techerp-test.invalid','authenticated','authenticated',now(),'{"full_name":"[ISO] Admin A"}'),
 ('10000000-0000-4000-8000-000000000002','own-a@techerp-test.invalid','authenticated','authenticated',now(),'{"full_name":"[ISO] Proprio A"}'),
 ('10000000-0000-4000-8000-000000000003','team-a@techerp-test.invalid','authenticated','authenticated',now(),'{"full_name":"[ISO] Equipe A"}'),
 ('10000000-0000-4000-8000-000000000004','ws-a@techerp-test.invalid','authenticated','authenticated',now(),'{"full_name":"[ISO] Workspace A"}'),
 ('10000000-0000-4000-8000-000000000005','removed-a@techerp-test.invalid','authenticated','authenticated',now(),'{"full_name":"[ISO] Removido A"}'),
 ('10000000-0000-4000-8000-000000000006','admin-b@techerp-test.invalid','authenticated','authenticated',now(),'{"full_name":"[ISO] Admin B"}'),
 ('10000000-0000-4000-8000-000000000007','peer-a@techerp-test.invalid','authenticated','authenticated',now(),'{"full_name":"[ISO] Par A"}')
ON CONFLICT DO NOTHING;

INSERT INTO public.workspaces (id, name, slug, created_by) VALUES
 ('aaaaaaaa-0000-4000-8000-00000000000a','[ISO] Tenant A','iso-tenant-a','10000000-0000-4000-8000-000000000001'),
 ('aaaaaaaa-0000-4000-8000-00000000000b','[ISO] Tenant B','iso-tenant-b','10000000-0000-4000-8000-000000000006')
ON CONFLICT DO NOTHING;

INSERT INTO public.workspace_members (workspace_id, user_id, role, status) VALUES
 ('aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','owner','active'),
 ('aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000002','member','active'),
 ('aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000003','member','active'),
 ('aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000004','member','active'),
 ('aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000005','member','active'),
 ('aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000007','member','active'),
 ('aaaaaaaa-0000-4000-8000-00000000000b','10000000-0000-4000-8000-000000000006','owner','active')
ON CONFLICT DO NOTHING;
-- "Removido": desativado depois de entrar (mesmo caminho do produto).
UPDATE public.workspace_members SET status = 'inactive'
 WHERE workspace_id = 'aaaaaaaa-0000-4000-8000-00000000000a' AND user_id = '10000000-0000-4000-8000-000000000005';

UPDATE public.profiles SET active_workspace_id = 'aaaaaaaa-0000-4000-8000-00000000000a'
 WHERE id IN ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003',
              '10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000007');
UPDATE public.profiles SET active_workspace_id = 'aaaaaaaa-0000-4000-8000-00000000000b' WHERE id = '10000000-0000-4000-8000-000000000006';

-- Conjuntos de permissão (chaves reais do catálogo) e cargos.
INSERT INTO public.permission_sets (id, module, name) VALUES
 ('20000000-0000-4000-8000-0000000000a1','techsales','[ISO] Próprio'),
 ('20000000-0000-4000-8000-0000000000a2','techsales','[ISO] Equipe'),
 ('20000000-0000-4000-8000-0000000000a3','techsales','[ISO] Workspace')
ON CONFLICT DO NOTHING;
INSERT INTO public.permission_set_items (set_id, permission_key)
SELECT s.id, k FROM (VALUES
  ('20000000-0000-4000-8000-0000000000a1'::uuid, 'own'),
  ('20000000-0000-4000-8000-0000000000a2'::uuid, 'team'),
  ('20000000-0000-4000-8000-0000000000a3'::uuid, 'workspace')) s(id, scope)
CROSS JOIN LATERAL (SELECT p.key FROM public.permissions p
  WHERE p.key IN ('techsales.activities.view.' || s.scope, 'techsales.activities.create.own',
                  'techsales.deals.view.' || s.scope, 'techsales.leads.view.' || s.scope)) x(k)
ON CONFLICT DO NOTHING;
INSERT INTO public.job_roles (id, name, workspace_id, owner_id) VALUES
 ('30000000-0000-4000-8000-0000000000a1','[ISO] Cargo próprio','aaaaaaaa-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-00000000000a'),
 ('30000000-0000-4000-8000-0000000000a2','[ISO] Cargo equipe','aaaaaaaa-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-00000000000a'),
 ('30000000-0000-4000-8000-0000000000a3','[ISO] Cargo workspace','aaaaaaaa-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-00000000000a')
ON CONFLICT DO NOTHING;
INSERT INTO public.job_role_sets (role_id, set_id) VALUES
 ('30000000-0000-4000-8000-0000000000a1','20000000-0000-4000-8000-0000000000a1'),
 ('30000000-0000-4000-8000-0000000000a2','20000000-0000-4000-8000-0000000000a2'),
 ('30000000-0000-4000-8000-0000000000a3','20000000-0000-4000-8000-0000000000a3')
ON CONFLICT DO NOTHING;
INSERT INTO public.user_job_roles (user_id, owner_id, workspace_id, role_id)
SELECT u, 'aaaaaaaa-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-00000000000a', r FROM (VALUES
 ('10000000-0000-4000-8000-000000000002'::uuid,'30000000-0000-4000-8000-0000000000a1'::uuid),
 ('10000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-0000000000a1'),
 ('10000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-0000000000a2'),
 ('10000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-0000000000a3'),
 ('10000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-0000000000a3')) v(u, r)
WHERE NOT EXISTS (SELECT 1 FROM public.user_job_roles x WHERE x.user_id = v.u AND x.role_id = v.r);

-- Equipe: 3 (líder) e 7 no mesmo grupo; 2 fora.
INSERT INTO public.user_groups (id, workspace_id, name) VALUES
 ('40000000-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-00000000000a','[ISO] Time 1') ON CONFLICT DO NOTHING;
INSERT INTO public.user_group_members (group_id, user_id, is_leader) VALUES
 ('40000000-0000-4000-8000-0000000000a1','10000000-0000-4000-8000-000000000003',true),
 ('40000000-0000-4000-8000-0000000000a1','10000000-0000-4000-8000-000000000007',false) ON CONFLICT DO NOTHING;

-- Leads/negócios (nome relacionado usado na busca de vazamento).
INSERT INTO public.leads (id, workspace_id, owner_id, first_name, last_name, email) VALUES
 ('50000000-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000002','Alfa','Fixture','alfa@techerp-test.invalid'),
 ('50000000-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-00000000000b','10000000-0000-4000-8000-000000000006','Zeta','SegredoB','zeta@techerp-test.invalid')
ON CONFLICT DO NOTHING;
INSERT INTO public.deals (id, workspace_id, owner_id, name, value, stage) VALUES
 ('51000000-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000002','[ISO] Negócio A2',1000,'won'),
 ('51000000-0000-4000-8000-0000000000a7','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000007','[ISO] Negócio A7',2000,'won'),
 ('51000000-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-00000000000b','10000000-0000-4000-8000-000000000006','[ISO] Negócio SegredoB',99000,'won')
ON CONFLICT DO NOTHING;

-- Atividades no lead A: uma de cada dono; uma no B.
INSERT INTO public.activities (id, workspace_id, owner_id, type, title, related_lead_id, created_at) VALUES
 ('52000000-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','note','[ISO] nota admin','50000000-0000-4000-8000-0000000000a1', now() - interval '3 hour'),
 ('52000000-0000-4000-8000-0000000000a2','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000002','note','[ISO] nota propria','50000000-0000-4000-8000-0000000000a1', now() - interval '2 hour'),
 ('52000000-0000-4000-8000-0000000000a7','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000007','note','[ISO] nota par','50000000-0000-4000-8000-0000000000a1', now() - interval '1 hour'),
 ('52000000-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-00000000000b','10000000-0000-4000-8000-000000000006','note','[ISO] nota SegredoB','50000000-0000-4000-8000-0000000000b1', now())
ON CONFLICT DO NOTHING;

INSERT INTO public.property_history (id, workspace_id, owner_id, entity, entity_id, property, old_value, new_value) VALUES
 ('53000000-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000002','lead','50000000-0000-4000-8000-0000000000a1','status','new','contacted'),
 ('53000000-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-00000000000b','10000000-0000-4000-8000-000000000006','lead','50000000-0000-4000-8000-0000000000b1','status','new','SegredoB')
ON CONFLICT DO NOTHING;

-- E-mail: caixa do 2 (A) e do 6 (B).
INSERT INTO public.email_accounts (id, workspace_id, owner_id, email) VALUES
 ('54000000-0000-4000-8000-0000000000a2','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000002','own-a@techerp-test.invalid'),
 ('54000000-0000-4000-8000-0000000000b6','aaaaaaaa-0000-4000-8000-00000000000b','10000000-0000-4000-8000-000000000006','admin-b@techerp-test.invalid')
ON CONFLICT DO NOTHING;
INSERT INTO public.email_threads (id, workspace_id, owner_id, account_id, provider_thread_id, subject, last_message_at) VALUES
 ('55000000-0000-4000-8000-0000000000a2','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-0000000000a2','iso-thr-a','[ISO] Assunto A', now()),
 ('55000000-0000-4000-8000-0000000000b6','aaaaaaaa-0000-4000-8000-00000000000b','10000000-0000-4000-8000-000000000006','54000000-0000-4000-8000-0000000000b6','iso-thr-b','[ISO] Assunto SegredoB', now())
ON CONFLICT DO NOTHING;
INSERT INTO public.email_messages (id, workspace_id, owner_id, account_id, thread_id, provider_message_id, direction, subject, body_text) VALUES
 ('56000000-0000-4000-8000-0000000000a2','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-0000000000a2','55000000-0000-4000-8000-0000000000a2','iso-msg-a','outbound','[ISO] Assunto A','corpo A'),
 ('56000000-0000-4000-8000-0000000000b6','aaaaaaaa-0000-4000-8000-00000000000b','10000000-0000-4000-8000-000000000006','54000000-0000-4000-8000-0000000000b6','55000000-0000-4000-8000-0000000000b6','iso-msg-b','outbound','[ISO] Assunto SegredoB','corpo SegredoB')
ON CONFLICT DO NOTHING;

-- WhatsApp (sem envio: só linhas).
INSERT INTO public.whatsapp_conversations (id, workspace_id, owner_id, contact_phone, twilio_number, contact_name, last_message_at) VALUES
 ('57000000-0000-4000-8000-0000000000a2','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000002','+5500000000001','+5500000000999','[ISO] Contato A', now()),
 ('57000000-0000-4000-8000-0000000000b6','aaaaaaaa-0000-4000-8000-00000000000b','10000000-0000-4000-8000-000000000006','+5500000000002','+5500000000998','[ISO] Contato SegredoB', now())
ON CONFLICT DO NOTHING;
INSERT INTO public.whatsapp_messages (id, workspace_id, conversation_id, owner_id, direction, from_number, to_number, body) VALUES
 ('58000000-0000-4000-8000-0000000000a2','aaaaaaaa-0000-4000-8000-00000000000a','57000000-0000-4000-8000-0000000000a2','10000000-0000-4000-8000-000000000002','outbound','+5500000000999','+5500000000001','oi A'),
 ('58000000-0000-4000-8000-0000000000b6','aaaaaaaa-0000-4000-8000-00000000000b','57000000-0000-4000-8000-0000000000b6','10000000-0000-4000-8000-000000000006','outbound','+5500000000998','+5500000000002','oi SegredoB')
ON CONFLICT DO NOTHING;

-- Chat interno: conversa entre 2 e 7.
INSERT INTO public.chat_conversations (id, workspace_owner_id, kind, created_by) VALUES
 ('59000000-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-00000000000a','direct','10000000-0000-4000-8000-000000000002') ON CONFLICT DO NOTHING;
INSERT INTO public.chat_conversation_members (conversation_id, user_id) VALUES
 ('59000000-0000-4000-8000-0000000000a1','10000000-0000-4000-8000-000000000002'),
 ('59000000-0000-4000-8000-0000000000a1','10000000-0000-4000-8000-000000000007') ON CONFLICT DO NOTHING;
INSERT INTO public.chat_messages (id, conversation_id, workspace_owner_id, sender_user_id, body) VALUES
 ('5a000000-0000-4000-8000-0000000000a1','59000000-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000002','[ISO] chat privado') ON CONFLICT DO NOTHING;

-- White Label por tenant.
INSERT INTO public.workspace_branding (id, workspace_id, owner_id, primary_color) VALUES
 ('5b000000-0000-4000-8000-0000000000a1','aaaaaaaa-0000-4000-8000-00000000000a','10000000-0000-4000-8000-000000000001','#111111'),
 ('5b000000-0000-4000-8000-0000000000b1','aaaaaaaa-0000-4000-8000-00000000000b','10000000-0000-4000-8000-000000000006','#222222')
ON CONFLICT DO NOTHING;
INSERT INTO public.module_branding (workspace_id, module_id) SELECT 'aaaaaaaa-0000-4000-8000-00000000000a', 'crm'
 WHERE NOT EXISTS (SELECT 1 FROM public.module_branding WHERE workspace_id = 'aaaaaaaa-0000-4000-8000-00000000000a' AND module_id = 'crm');
INSERT INTO public.module_branding (workspace_id, module_id) SELECT 'aaaaaaaa-0000-4000-8000-00000000000b', 'crm'
 WHERE NOT EXISTS (SELECT 1 FROM public.module_branding WHERE workspace_id = 'aaaaaaaa-0000-4000-8000-00000000000b' AND module_id = 'crm');
