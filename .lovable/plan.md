# Substatus por Etapa de Pipeline (TechSales)

## O que existe hoje (verificado)

- `public.pipelines` guarda etapas em **JSONB** (`stages: [{value,label,color,probability,type,sla_hours}]`) — não há tabela de etapas. Isolamento por `workspace_id`.
- `leads` e `deals` guardam `pipeline_id uuid` + `stage_id text` (valor da etapa no JSON). `leads.status` e `deals.stage` continuam como enums legados derivados.
- Kanban genérico: `src/components/kanban/kanban-board.tsx` (colunas por etapa, `stageField`, seleção em massa) e o quadro de negócios `src/components/deals/deals-board*.tsx`.
- Configuração: `src/routes/_authenticated/settings.pipelines.tsx` (editor de etapas com ordenação por setas, permissão `PIPELINES_MANAGE` via `<Can>`).
- Auditoria: trigger `log_property_changes` grava **qualquer coluna alterada** de leads/deals em `property_history` — a nova coluna entra no histórico automaticamente.
- Automações: catálogo de campos por entidade é derivado das colunas (`src/lib/entity-fields*.ts`), então o novo campo fica disponível como condição/ação no Workflow Builder.
- Conversão Lead → Negócio já existe: `src/components/leads/create-deal-from-lead-dialog.tsx`.

## Decisões de arquitetura

- Nova tabela **`pipeline_stage_substatuses`**: `id`, `workspace_id`, `owner_id`, `pipeline_id`, `stage_value` (texto, casa com `stages[].value`), `name`, `description`, `color`, `position`, `is_active`, `is_default`, `created_at`, `updated_at`. Índice único parcial garante um só padrão por etapa; RLS/GRANT no mesmo padrão de `pipelines`.
- Colunas novas e nulas: `leads.stage_substatus_id` e `deals.stage_substatus_id` (FK `ON DELETE SET NULL`). Nada é preenchido retroativamente.
- Validação no banco: trigger que rejeita substatus cujo `pipeline_id`/`stage_value` não corresponde ao `pipeline_id`/`stage_id` do registro, e que **limpa** o substatus quando a etapa muda (aplicando o padrão da nova etapa, se houver).
- Camada compartilhada em `src/lib/pipelines/substatuses.ts` (tipos/helpers) + `substatuses.functions.ts` (CRUD) reutilizada por Leads e Negócios — sem código duplicado por entidade.

## Escopo da implementação

1. **Migration**: tabela, GRANTs, RLS por workspace, colunas em `leads`/`deals`, triggers de validação/limpeza, trigger de `updated_at`.
2. **Configuração** (`settings.pipelines.tsx`): dentro de cada etapa, uma seção "Substatus" com criar/editar/desativar/excluir, reordenar (mesmo padrão de setas já usado) e marcar padrão — protegida por `PIPELINES_MANAGE`.
3. **Seletor reutilizável** `SubstatusSelect` (design system atual): lista só substatus ativos da etapa atual; vazio quando a etapa não tem substatus.
4. **Detalhes**: em `leads.$id.tsx` e `deals.$id.tsx`/`deal-detail-drawer.tsx`, exibir Pipeline → Etapa → Substatus; ao trocar etapa, a lista recarrega e o valor é redefinido pelo padrão.
5. **Kanban**: badge discreto no card (Leads e Negócios) com popover de troca rápida, com loading, erro e toast de sucesso.
6. **Filtros**: substatus nos filtros de Leads e Negócios, dependente do pipeline/etapa selecionados, combinável com os filtros atuais.
7. **Contagens por substatus** no cabeçalho da coluna do Kanban (tooltip/resumo), sem novo dashboard.
8. **Conversão Lead → Negócio**: reaproveitar o diálogo existente; nenhuma nova regra hardcoded por nome de etapa.
9. **Seed opcional**: um botão "Sugerir substatus" por etapa que preenche exemplos editáveis. Nenhuma etapa existente é criada, renomeada ou reclassificada automaticamente — as etapas novas de Leads ficam a cargo do administrador no editor.

## Fora do escopo agora

- Restringir substatus por serviço (a estrutura permite adicionar depois).
- Automações prontas: apenas expor Etapa/Substatus como condição e ação configuráveis.
- Alterar enums legados (`leads.status`, `deals.stage`) ou etapas atuais.

## Validação

`bun run lint`, `bun run typecheck`, `bun run test`, e verificação manual em `/settings/pipelines`, `/leads` (tabela e quadro) e `/deals` (tabela e quadro), light/dark e 768/1280.
