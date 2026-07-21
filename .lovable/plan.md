## Problema

As ações genéricas `create_record`, `update_record` e `delete_record` (Fase 1 da expansão cross-módulo) foram implementadas em tipos, schemas, engine e no formulário `GenericRecordForm`, mas **não aparecem no picker de "Adicionar ação"** do Workflow Builder porque não estão listadas em nenhum grupo de `ACTION_GROUPS` em `src/lib/workflows/types.ts`.

Verificação: `ACTION_GROUPS` (linhas 440-481) inclui grupos "Criar registro", "CRM", "Comunicação", etc., mas nenhum deles referencia `create_record` / `update_record` / `delete_record`. O picker itera exatamente sobre esses grupos, então as três ações ficam invisíveis apesar de já roteadas nos `switch` do builder e do renderer.

## Alteração

Editar `src/lib/workflows/types.ts` adicionando um novo grupo no array `ACTION_GROUPS`, posicionado logo após "Criar registro":

```ts
{
  label: "Registros (qualquer módulo)",
  actions: ["create_record", "update_record", "delete_record"],
},
```

## Escopo

- Arquivo alterado: `src/lib/workflows/types.ts` (somente `ACTION_GROUPS`).
- Sem mudanças em engine, schemas, RLS, migrations ou outros componentes — tudo já suporta essas ações.

## Validação manual

1. Abrir `/settings/workflows`, editar/criar workflow.
2. Em qualquer passo, clicar "Adicionar ação" → confirmar grupo "Registros (qualquer módulo)" com as três opções.
3. Selecionar "Criar registro", escolher tabela (ex.: `financial_entries`), preencher campos com tokens e salvar.
