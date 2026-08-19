# Lote 1b-i: resolver os registros órfãos de workspace

Migration única, pequena e rápida (poucas linhas afetadas), para fechar o backfill iniciado na etapa 1a antes de qualquer mudança em políticas ou remoção de `owner_id`.

Estado confirmado agora no banco:

- `bug_reports`: 5 registros sem workspace (dono `933274f6…`, usuário que não é membro do workspace)
- `user_job_roles`: 1 registro sem workspace (dono `6a2aee24…`)
- `workflow_subscriptions`: 2 registros sem workspace (dono `6a2aee24…`)
- `field_permission_rules`: 14 registros sem workspace, todos com `is_system = true` e sem dono
- Existe apenas 1 workspace no ambiente: `WK Technology` (`184b9435-0a9b-4334-9e89-8854dc883f5d`)

## O que a migration faz

1. Atribui o workspace `WK Technology` aos 8 registros órfãos de `bug_reports`, `user_job_roles` e `workflow_subscriptions` (é o único workspace existente, então não há ambiguidade de cliente).
2. Torna `workspace_id` obrigatório e ligado ao cadastro de workspaces (FK com remoção em cascata) nessas três tabelas.
3. `field_permission_rules`: mantém `workspace_id` opcional e adiciona apenas a FK, porque as 14 linhas são regras de sistema globais, válidas para todos os workspaces. Adiciona uma regra de integridade: linha de sistema pode ficar sem workspace, linha não-sistema passa a exigir workspace.

Nada de políticas de acesso, funções ou remoção de coluna nesta etapa — `owner_id` continua intacto e o comportamento do app não muda.

## Validação após aplicar

- Contagem de `workspace_id` nulo nas quatro tabelas: esperado 0 nas três primeiras e 14 (todas de sistema) em `field_permission_rules`.
- Conferir que os 98 chamados internos continuam visíveis em `/admin/bug-reports`.

## Por que fatiado

A tentativa anterior de rodar órfãos + obrigatoriedade + criação de `assigned_to` em 16 tabelas na mesma migration foi cancelada pelo banco com `canceling statement due to statement timeout` e revertida por inteiro. Esta migration toca 4 tabelas pequenas e cabe no limite de tempo com folga.

## Próximo passo (não incluído aqui)

Criar `assigned_to` em lotes de 3–4 tabelas, começando pelas maiores (`contacts`, `companies`, `activities`, `leads`, `deals`).
