# Visibilidade de registros controlada por permissões (padrão: todos veem tudo)

## Diagnóstico (verificado no banco)

- As tabelas core do TechSales (`leads`, `contacts`, `companies`, `deals`) já são visíveis por workspace inteiro — não há filtro por responsável nem no RLS nem nas telas.
- O problema está nos módulos cujas políticas de leitura exigem **dono do registro** OU uma permissão `*.view.workspace` que a maioria dos usuários **não possui**. Exemplos confirmados:
  - Um membro comum do workspace principal tem apenas 285 permissões efetivas e está **sem** chaves como `techsales.tasks.view.workspace`, `techservice.tickets.view.workspace`, `techprojects.timesheet.view.workspace`, `techfinance.*.view.workspace` e a maior parte das chaves de `techhire.*` (entrevistas, scorecards, pipelines, sourcing, pools, etc.).
  - Nessas tabelas as políticas de leitura caem no ramo "sou o dono" (`owner_id = auth.uid()`, `can_write_owner(...)`), por isso o usuário só vê o que está no nome dele.
  - `user_data_scope` devolve `own` para membros/managers porque os cargos (`job_roles.data_scope`) estão como `own`, o que restringe ainda mais os ramos de time/workspace.
- Conclusão: a arquitetura de permissões existe (permissões, cargos, conjuntos, RLS por chave), mas o **conteúdo padrão das permissões** e algumas políticas antigas de "somente dono" produzem a invisibilidade relatada.

## Objetivo

Deixar a visibilidade 100% governada pelas permissões e, como padrão, liberar leitura de todos os registros do workspace para qualquer usuário — mantendo criação, edição e exclusão como estão hoje (também por permissão), para o ajuste manual posterior.

## Fase 1 — Padrão de permissões de leitura (migration + dados)

1. Criar/garantir um conjunto de permissões do sistema por workspace: **"Visibilidade total (padrão)"**, contendo todas as chaves `permissions` de ação `view` em escopo `workspace` (e as `team`/`own` correspondentes).
2. Vincular esse conjunto a **todos os cargos existentes** (`job_role_sets`) de cada workspace, sem remover nada do que já está atribuído.
3. Ajustar `job_roles.data_scope` de `own` para `workspace` nos cargos existentes (padrão de leitura ampla).
4. Popular `job_role_default_permissions` com as chaves de `view` para que **cargos novos** já nasçam com leitura ampla.
5. Remover eventuais overrides `deny` de chaves `*.view.*` existentes (hoje não há regra de negócio dependendo deles; ficam para o ajuste manual futuro).

Nada de escrita/exclusão é ampliado nesta fase.

## Fase 2 — Normalizar as políticas de leitura (migration)

Para as tabelas de registro cujo SELECT hoje depende de "ser dono", padronizar a leitura como:

```text
workspace_id pertence aos workspaces do usuário
E ( admin do workspace
    OU possui a permissão de view do recurso (workspace | team | own conforme o caso) )
```

Tabelas alvo (grupo TechHire e demais módulos com política "somente dono"):
`ats_jobs`, `ats_candidates`, `ats_applications`, `ats_application_events`, `ats_interviews`, `ats_interview_kits`, `ats_scorecards`, `ats_scorecard_responses`, `ats_offers`, `ats_pipelines`, `ats_job_postings`, `ats_talent_pools`, `ats_talent_pool_members`, `ats_sourcing_*`, `ats_hunting_*`, `ats_match_scores`, `ats_stage_emails`, `ats_candidate_*`, além de `contracts`, `contract_templates`, `macros`, `financial_entries`, `customer_invoices`, `deal_contacts`, `activities` e as tabelas de tickets/projetos/pessoas que seguem o mesmo padrão.

Regras da fase:

- Não mexer em tabelas de dados pessoais do próprio usuário (contas de e-mail, calendário, sessões de copilot, chaves de API, logs de auditoria) — essas continuam restritas ao dono.
- Não alterar políticas de INSERT/UPDATE/DELETE.
- Manter o gate por chave de permissão para que a restrição manual futura funcione apenas alterando permissões.

## Fase 3 — Coerência no aplicativo

- Revisar as server functions que exigem chaves `*.view.own` como alternativa (serviços, contratos/modelos, presets, perfis de cargo) para aceitar também a chave de workspace, evitando telas vazias com permissão ampla.
- Nenhuma tela passa a filtrar por responsável; os filtros por "Responsável" continuam sendo opção do usuário nos grids.

## Fase 4 — Validação

- Consulta comparando, para um usuário membro real, a contagem de registros visíveis antes/depois por tabela (leads, negócios, tarefas, vagas, candidatos, candidaturas, entrevistas, contratos, tickets, projetos, lançamentos financeiros).
- Sessão de preview autenticada como um usuário não-admin (Playwright) conferindo que os grids dos módulos mostram registros de outros responsáveis.
- `bun run typecheck`, `bun run lint` e `bun run test` nas partes afetadas.
- Linter de segurança do banco após as migrations.

## Detalhes técnicos

- Migrations idempotentes: `INSERT ... ON CONFLICT DO NOTHING` para conjuntos/vínculos; `DROP POLICY IF EXISTS` + `CREATE POLICY` para as políticas de leitura, sempre com `TO authenticated`.
- Nenhuma tabela nova é criada; nenhuma `GRANT` adicional é necessária (as tabelas já têm grants).
- Toda a avaliação continua em funções `security definer` existentes (`user_has_permission`, `user_effective_permissions`, `is_workspace_admin_of`), sem recursão em RLS.

## Riscos

- Ampliar leitura expõe, dentro do workspace, dados sensíveis de módulos como TechPeople e TechFinance a todos os usuários. É o comportamento pedido; o ajuste fino depois é feito removendo chaves de `view` dos cargos.
- Reescrever políticas em muitas tabelas exige atenção para não perder ramos legítimos (ex.: candidato acessando o próprio portal público) — cada política reescrita preserva os ramos públicos/portal existentes.
