# Correção do preenchimento automático de `Negócio` e `Contrato principal` no Workflow

## Contexto

Na tela de workflow, ao configurar uma ação que cria um **Contrato**, os campos de FK:

- `Negócio` (`deal_id`)
- `Contrato principal (aditivo/renovação)` (`parent_contract_id`)

estão aparecendo com token genérico (`{{email}}` na imagem) ou exigindo preenchimento manual. O autofill atual não sabe que, quando o workflow dispara de um **Negócio**, o campo `deal_id` deve receber o `id` do registro origem; e quando dispara de um **Contrato**, `parent_contract_id` deve receber o `id` do contrato origem.

## Objetivo

Fazer com que o preenchimento automático desses campos use o token correto (`{{id}}`) quando a entidade de origem do workflow for compatível, e garantir que a engine também faça o vínculo automaticamente em runtime caso o campo tenha ficado vazio.

## Plano técnico

### 1. Propagar a entidade de origem do workflow

O `WorkflowDraft` já possui `entity: WorkflowEntity` (a entidade que dispara o workflow). Essa informação precisa chegar até o `ExtraFieldsEditor` e ao `GenericRecordForm`.

- `src/components/workflows/workflow-builder.tsx`: passar `triggerEntity={draft.entity}` para todos os lugares que renderizam `<ExtraFieldsEditor>` e `<GenericRecordForm>`.
- `src/components/workflows/extra-fields-editor.tsx`: adicionar prop opcional `triggerEntity?: WorkflowEntity`.
- `src/components/workflows/generic-record-form.tsx`: adicionar prop opcional `triggerEntity?: WorkflowEntity` e repassar ao `ExtraFieldsEditor`.

### 2. Aliases contextualizados de tokens

Em `src/components/workflows/extra-fields-editor.tsx`, estender `TOKEN_ALIAS` para considerar a entidade de origem:

- Se `triggerEntity === "deals"`, `deal_id` → `{{id}}`
- Se `triggerEntity === "contracts"`, `parent_contract_id` → `{{id}}`

Isso faz com que o botão "Preencher automaticamente" e qualquer autofill futuro usem o token correto.

### 3. Fallback na engine de workflow

Em `src/lib/workflows/engine.server.ts`, na execução de `create_record` (e futuramente ações específicas de contrato, se existirem), após renderizar os tokens:

- Se a tabela alvo for `contracts` e `deal_id` estiver vazio/nulo, e a entidade de origem for `deals`, atribuir `ctx.entityId`.
- Se a tabela alvo for `contracts` e `parent_contract_id` estiver vazio/nulo, e a entidade de origem for `contracts`, atribuir `ctx.entityId`.

Isso garante que o vínculo funcione mesmo que o usuário não tenha preenchido o campo.

### 4. Validação

- Abrir o workflow builder, criar uma ação "Criar registro" → tabela `contracts`.
- Clicar em "Preencher automaticamente" e verificar que `Negócio` e/ou `Contrato principal` recebem `{{id}}` quando a entidade de origem for compatível.
- Simular execução do workflow a partir de um negócio e confirmar que o contrato criado tem `deal_id` preenchido.
- Simular execução a partir de um contrato e confirmar que o novo contrato tem `parent_contract_id` preenchido.

## Arquivos alterados

- `src/components/workflows/extra-fields-editor.tsx`
- `src/components/workflows/generic-record-form.tsx`
- `src/components/workflows/workflow-builder.tsx`
- `src/lib/workflows/engine.server.ts`

## Escopo

Apenas correção do preenchimento automático e do fallback em runtime para os campos `deal_id` e `parent_contract_id` em ações de criação de contrato via workflow. Não altera schema, RLS, regras de negócio ou outras entidades.
