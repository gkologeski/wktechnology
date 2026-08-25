# Remover owner_id: workspace_id como fonte única de isolamento

Objetivo: eliminar completamente a coluna `owner_id` do banco e do código. O isolamento por cliente passa a depender exclusivamente de `workspace_id`, e o conceito de "responsável" pelo registro passa a ser `assigned_to`.

Escala real levantada no banco e no código:

- 223 tabelas com `owner_id`
- 535 políticas de RLS que referenciam `owner_id`
- 188 índices, 46 funções/triggers e 3 views que referenciam `owner_id`
- ~2.100 referências no código (269 filtros `.eq("owner_id", ...)`, 621 inserts com `owner_id:`)
- 26 tabelas com `owner_id` mas **sem** `workspace_id` (ex.: `kb_articles`, `people_documents`, `people_goals`, `people_reviews`, `people_incidents`, `people_benefits`, `people_one_on_ones`, `prospecting_queues`, `unipile_accounts`, `bug_reports`, `notifications`, `copilot_sessions`, `domain_events`, `workflow_*`, `ml_*`)

Execução em uma única leva (conforme escolhido), organizada internamente em 6 etapas na mesma entrega.

## O que será feito

### 1. Responsável vira `assigned_to`

Tabelas onde a UI hoje mostra `owner_id` como "Proprietário/Responsável" (deals, leads, contatos, empresas, atividades, tickets, projetos, reuniões, contratos e similares) receberão `assigned_to` quando ainda não tiverem, com backfill a partir de `owner_id`. Onde `assigned_to` já existe, o valor só é preenchido se estiver vazio.

Em tabelas de escopo pessoal (notificações, sessões do copiloto, assinaturas push, papéis/permissões por usuário, cursores de workflow), `owner_id` passa a ser `user_id` — continua sendo "de quem é", mas sem papel de tenant.

### 2. Garantir `workspace_id` nas 26 tabelas faltantes

Adicionar `workspace_id` (NOT NULL, FK para `workspaces`, índice), com backfill derivado do `owner_id` atual (ou da entidade pai, quando for tabela satélite) e trigger de preenchimento automático no insert. Tabelas puramente globais/plataforma (`domain_events`, `ml_scoring_models`) e de escopo pessoal são classificadas e tratadas sem `workspace_id`.

### 3. Reescrever as 535 políticas de RLS

Padrão único já usado no projeto:

```text
USING      workspace_id IN (SELECT current_user_workspaces())
WITH CHECK workspace_id IN (SELECT current_user_workspaces())
+ gate RBAC (user_can_act / is_workspace_admin) quando a tabela já exigia
+ escopo "own" passa a comparar assigned_to = auth.uid()  (nunca mais owner_id)
```

Políticas duplicadas/sobrepostas herdadas do modelo antigo serão consolidadas por tabela e ação. `GRANT` de cada tabela é revalidado (sem `anon` em dados de cliente).

### 4. Limpar dependências no banco

- Recriar as 3 views sem `owner_id`
- Remover/reescrever as 46 funções e triggers que espelhavam `owner_id` (inclui `sync_workspace_owner_id`)
- Remover os 188 índices e as constraints/uniques que envolvem `owner_id`
- `ALTER TABLE ... DROP COLUMN owner_id` nas 223 tabelas

### 5. Refactor de código (~2.100 pontos)

- Remover `owner_id` de todos os inserts, selects explícitos, filtros e tipos locais
- Substituir por `workspace_id` (isolamento) ou `assigned_to` (responsável) conforme o caso
- Ajustar colunas/avatares de "Proprietário" nas listas (deals, leads, contatos, empresas, tickets) para ler `assigned_to`
- Ajustar rotas públicas/webhooks/API v1, SCIM, widget, hunting e engines de workflow/e-mail que hoje escrevem `owner_id`
- Atualizar catálogo de tokens de workflow: `{{owner_id}}` passa a `{{assigned_to}}`, com compatibilidade de leitura para workflows já salvos
- Regenerar os tipos do banco após a migration

### 6. Validação

- `typecheck`, `lint` e `build`
- Consultas de conferência: nenhuma coluna `owner_id` restante, nenhuma política citando `owner_id`, zero `workspace_id` nulo
- Smoke manual nos fluxos críticos: criar/editar lead, qualificação, deal + itens de linha, contrato, vaga/candidato, pessoa/alocação, atividade e pesquisa

## Riscos

- Volume alto: qualquer insert que dependia do default de `owner_id` precisa passar a informar `workspace_id`; a trigger de preenchimento reduz, mas não elimina, esse risco.
- Workflows salvos que referenciam `{{owner_id}}` em campos de texto: tratados por compatibilidade de leitura, mas devem ser revisados depois.
- Registros legados sem como inferir workspace ficam bloqueados pela RLS; a migration falha explicitamente antes do `DROP` se encontrar órfãos, em vez de perder dados.
- Rollback de `DROP COLUMN` não é trivial: a validação de órfãos e o backfill acontecem antes de qualquer remoção, na mesma transação.

## Como validar manualmente

1. Entrar com um usuário comum e conferir que listas de leads, deals, contatos, empresas, vagas, candidatos e pessoas continuam populadas.
2. Conferir que a coluna "Proprietário" mostra o mesmo nome de antes (agora vindo de `assigned_to`).
3. Criar um registro novo em cada módulo e confirmar que ele aparece imediatamente.
4. Com um usuário de outro workspace, confirmar que nenhum registro do primeiro workspace aparece.
