## Objetivo

1. Permitir inserir variáveis (`{{token}}`) como pills clicáveis em **todos** os campos de texto do construtor de Workflows (não apenas nos poucos que hoje têm `TokenPills`).
2. Corrigir a exibição de referências (usuário, empresa, pipeline, etapa, sequência, regra) que hoje mostram o hash do UUID em vez do nome amigável.

Escopo restrito a UI/apresentação no builder de workflows. Não altera engine, schemas, RLS ou lógica de negócio.

## Mudanças

### 1. Componente único de input com pills

Criar `src/components/workflows/token-input.tsx`:
- `TokenInput` e `TokenTextarea` (wrappers de `Input`/`Textarea` do shadcn).
- Rastreiam a posição do cursor via `ref` e `onSelect`.
- Renderizam um botão discreto `{ }` (ícone `Braces`) no canto do campo → abre `Popover` com `TokenPills` agrupadas + busca (`Command`).
- Ao clicar em um token, inserem `{{token}}` na posição do cursor (ou substituem a seleção) e disparam `onChange`.
- Aceitam prop `tokens: MessageToken[]` (default `WORKFLOW_TOKENS`) e todas as props padrão de `Input`/`Textarea`.
- Suportam também abrir o popover via atalho: digitar `{{` abre o picker inline (opcional; se aumentar risco, fica só o botão).

### 2. Substituir campos de texto do workflow

Em `src/components/workflows/workflow-builder.tsx`, trocar `Input`/`Textarea` por `TokenInput`/`TokenTextarea` nos campos de conteúdo que aceitam tokens hoje (todos os `placeholder="... {{...}}"` já mapeados):

- `create_ats_job.title`
- `create_ats_candidate.full_name`
- `create_lead` (first_name, last_name, company, email...)
- `create_contact` (first_name, last_name, email...)
- `create_company.name`
- `create_deal.name`
- `create_ticket.subject`
- `create_task.subject`, `description`
- `send_notification.title`, `text`
- `webhook.text` (Teams/Slack)
- `approval.title`, `note`
- `format_data.template`
- `set_field.value`
- `associate_records.target_id`
- Demais campos textuais das ações que hoje mostram `placeholder` com `{{...}}`.

### 3. Pills no editor de "Mais campos"

Em `src/components/workflows/extra-fields-editor.tsx`:
- Trocar os `Input`/`Textarea` de tipo `text`/long-text por `TokenInput`/`TokenTextarea`.
- Fazer o mesmo no `CustomFieldsEditor` (coluna de valor).
- Campos `number`, `boolean`, `date`, `select` seguem inalterados.

### 4. Referências passam a exibir nomes, não UUIDs

Criar hook leve `useReferenceLabels()` em `src/components/workflows/use-reference-labels.ts`:
- Uma única `useQuery` (staleTime 5min) que carrega em paralelo:
  - `profiles` (id, full_name, email) — usuários do workspace.
  - `companies` (id, name).
  - `pipelines` (id, name, stages) — para mapear `stage`.
  - `sequences` (id, name).
  - `rotation_rules` (id, name).
- Devolve helpers: `labelForUser(id)`, `labelForCompany(id)`, `labelForPipeline(id)`, `labelForStage(pipelineId, stageValue)`, `labelForSequence(id)`, `labelForRule(id)`.
- Fallback: se não encontrar, retorna string curta amigável (`"usuário removido"` ou os 8 primeiros chars).

Usar o hook em:
- `describeAction` (linhas ~3263-3310 e vizinhas) para `assign_to`, `rotate_assign`, `add_to_sequence`, `assign_recruiter`, `associate_records`, `create_activity` (assignee) etc. — trocar o `slice(0,8)+"…"` pelos nomes reais.
- Chip/resumo do passo na barra lateral e cabeçalho do card de ação (quando exibe um subtítulo com hash).
- `ExtraFieldsEditor`: quando o campo for FK conhecido (`company_id`, `owner_id`, `assigned_user_id`, `pipeline_id`, `parent_company_id`), renderizar um `Combobox` de busca com os nomes já resolvidos, em vez de `Input` de UUID. Continua permitindo colar `{{token}}` via botão de "usar variável".

Como `describeAction` é uma função pura hoje, refatorar a assinatura para `describeAction(a, labels)` e passar o objeto de helpers a partir do componente que já é React (o `StepChip`/renderer do builder). Nenhum caller server-side.

### 5. Não escopo

- Não altera `engine.server.ts` (resolução de tokens continua idêntica).
- Não altera schema/tipos das ações.
- Não altera RLS nem catálogo de tokens (mantém `WORKFLOW_TOKENS`); ampliar catálogo pode ser feito em passo futuro se o usuário pedir.

## Validação

- `bunx tsgo --noEmit`.
- Manual no `/settings/workflows`:
  - Abrir uma ação, clicar no botão `{}` em cada campo de texto, escolher uma variável, ver o token aparecer no cursor.
  - Confirmar que o `describeAction` do passo (chip lateral) mostra "João Silva" em vez de `f3a4b2c1…`.
  - Em "Mais campos", adicionar `company_id` e ver combobox com nomes das empresas.

## Riscos

- `TokenInput` precisa preservar `ref`, `onSelect`, `onBlur` sem quebrar formulários existentes — mitigado repassando todas as props e usando `forwardRef`.
- `describeAction` hoje é usada em outros locais? Verificar antes de alterar assinatura; se sim, manter overload sem `labels` retornando o comportamento atual (fallback UUID curto).
