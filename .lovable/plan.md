## Objetivo
Expor todos os campos de ticket no builder de workflows e traduzir rótulos para pt-BR.

## Mudanças

### 1. `src/components/workflows/workflow-builder.tsx`
- Adicionar campo **Pipeline** (via `FkPicker` apontando para `pipelines`, filtrado por `entity='ticket'`) no formulário principal da ação `create_ticket`, ao lado de Prioridade e Responsável.
- Ajustar `hiddenKeys` de `create_ticket` para remover `pipeline_id` (já exposto no form principal) mas manter apenas IDs de sistema ocultos (`id`, `owner_id`, `workspace_id`, `created_at`, `updated_at`, `deleted_at`, `subject`, `description`, `priority`, `assignee_id`, `pipeline_id`).
- Resultado: seção "Mais campos" mostra todos os demais campos da tabela `tickets` (status, source, due_at, sla_policy_id, contact_id, company_id, deal_id, tags, etc.).

### 2. `src/lib/entity-fields.functions.ts`
- Ampliar o mapa `LABELS` com rótulos pt-BR para campos de `tickets` e afins:
  - `subject` → "Assunto"
  - `priority` → "Prioridade"
  - `assignee_id` → "Responsável"
  - `due_at` → "Vence em"
  - `sla_policy_id` → "Política de SLA"
  - `first_response_at` → "Primeira resposta em"
  - `resolved_at` → "Resolvido em"
  - `closed_at` → "Fechado em"
  - `reopened_at` → "Reaberto em"
  - `contact_id` → "Contato"
  - `deal_id` → "Negócio"
  - `tags` → "Tags"
  - `channel` → "Canal"
  - `category` → "Categoria"
  - `subcategory` → "Subcategoria"
  - `resolution` → "Resolução"
  - `satisfaction_score` → "Nota de satisfação"
  - + demais campos remanescentes de `tickets` que existirem.

### 3. Escopo fora
- Sem mudanças no engine (`engine.server.ts`), RLS, schema ou lógica de negócio.
- Aplicável apenas ao painel do builder; execução do workflow permanece inalterada.

## Validação
- Abrir workflow "Criar contrato" → ação "Criar ticket" → confirmar campo Pipeline visível e populável.
- Seção "Mais campos" lista rótulos em pt-BR e permite adicionar qualquer coluna da tabela `tickets`.
