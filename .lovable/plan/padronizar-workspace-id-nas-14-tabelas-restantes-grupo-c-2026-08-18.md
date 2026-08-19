# Padronizar `workspace_id` nas 14 tabelas restantes (grupo c)

Fechar a última lacuna do isolamento por cliente: as tabelas de Ads, A/B tests,
atribuição, landing pages, live chat, base de conhecimento (categorias), log de
cadência de sourcing e eventos de webhook de pagamento passam a usar a coluna
`workspace_id` e o mesmo padrão de política já aplicado em `people`.

## Situação atual (verificada no banco)

- 13 tabelas guardam o workspace na coluna `owner_id` e **não** possuem
  `workspace_id`: `ads_accounts`, `ads_audiences`, `ads_lead_forms`, `ab_tests`,
  `ab_test_events`, `attribution_touchpoints`, `landing_pages`,
  `landing_page_events`, `live_chat_sessions`, `live_chat_messages`,
  `kb_categories`, `ats_sourcing_step_log`.
- `payment_webhook_events` já tem `workspace_id` e RLS ativa **sem políticas**
  (fechada de propósito, gravada apenas pelo servidor).
- RLS está habilitada em todas; as políticas usam `is_workspace_member(owner_id, …)`,
  `is_workspace_admin_v2/_of(owner_id, …)` ou `can_write_owner(owner_id, …)`.
- `ats_sourcing_step_log` ainda aceita o atalho inseguro `owner_id = auth.uid()`.
- Volume de dados: praticamente vazias (1 landing page, 1 sessão e 4 mensagens de
  chat; as demais com 0 linhas) e nenhum `owner_id` órfão — o backfill é trivial
  e sem risco.

## O que será feito

### 1. Migração de banco (aditiva)

Para cada uma das 12 tabelas de dados de cliente + `ats_sourcing_step_log`:

- adicionar `workspace_id uuid` com FK para `workspaces(id)` e índice;
- backfill a partir de `owner_id`, depois `NOT NULL`;
- trigger de sincronização `workspace_id` ⟷ `owner_id` em insert/update
  (mantém `owner_id` por compatibilidade com o código atual);
- reescrever as políticas para o padrão do projeto:
  `workspace_id IN (SELECT current_user_workspaces())` combinado com a regra de
  papel que já existia hoje (membro para leitura/escrita comum; administrador do
  workspace para `ads_accounts` e para update/delete de `landing_pages`), mais o
  bypass de administrador de plataforma;
- remover de `ats_sourcing_step_log` o atalho `owner_id = auth.uid()`;
- manter os GRANTs atuais (nenhuma tabela ganha acesso anônimo).

`payment_webhook_events` não muda: permanece sem políticas, acessível somente
pelo servidor. Fica registrado no documento de conformidade.

Leitura pública de landing page publicada continua funcionando: ela já passa por
server function com cliente administrativo e projeção mínima, não por política
anônima.

### 2. Código (apenas incluir `workspace_id` nas escritas)

- `src/lib/ads-sync.functions.ts` — inserts de conta e audiência.
- `src/lib/ab-tests.functions.ts` — inserts de teste e evento.
- `src/lib/attribution.functions.ts` — inserts de touchpoint.
- `src/lib/landing-pages.functions.ts` — insert/update de página e evento.
- `src/lib/kb.functions.ts` — insert de categoria.
- `src/lib/live-chat.functions.ts` e as rotas públicas
  `src/routes/api/public/widget/session.ts` e `.../messages.ts` — sessões e
  mensagens do widget (o workspace vem do próprio widget, sem mudar o contrato).

Nenhuma mudança de UX, layout ou regra de negócio. Os triggers garantem
consistência mesmo se alguma escrita passar só `owner_id`.

### 3. Documentação e validação

- Atualizar `docs/workspace-isolation-compliance.md`: mover as tabelas do grupo
  (c) para "padronizadas", zerando o grupo, e registrar a exceção
  `payment_webhook_events`.
- Rodar a consulta de conformidade da seção 1 do documento e confirmar 0
  registros com `workspace_id` nulo e 0 divergências com `owner_id`.
- Rodar typecheck e lint.
