# Prospecção: permissões granulares + filas invisíveis para o marketing@

## O que foi verificado

1. **Catálogo de permissões**: existem apenas **9 chaves** para prospecção, todas de leitura:
   `techsales.prospecting.{queue,cadences,questionnaires,scoring,playbooks,enrichment,search,scripts,voice}.view`.
   Não existe nenhuma chave `create`/`update`/`delete`/`export` — por isso a matriz do diagnóstico mostra só "Exibir".
   Comparativo: `techsales.leads` tem 12 chaves (view/create/update/delete/export/assign nos escopos workspace/team/own).
2. **`/prospecting` não está mapeada** em `MENU_RESOURCES_BY_URL` (`src/lib/menu-resources.ts`), então a matriz cai no fallback das chaves do menu — apenas as `*.view`.
3. **Por que o marketing@ não vê registros**: a tabela `prospecting_queues` tem **uma única policy**, `ALL USING (owner_id = auth.uid())`. As duas filas existentes ("Fila teste 001" e "teste") pertencem ao seu usuário e estão com `is_shared = false`. O campo `is_shared` existe no formulário e no banco, mas **nenhuma policy o usa** — ou seja, hoje fila é sempre privada do criador, independentemente de permissão.
4. **Sem enforcement server-side**: `src/lib/prospecting/queues.functions.ts` não chama `assertPermission`/`assertAnyPermission`; o controle hoje é só a RLS de dono e a exibição das abas.

## Plano

### 1. Catálogo granular de prospecção (migration)

Cadastrar em `public.permissions`, para cada recurso de prospecção, o conjunto completo de ações nos escopos aplicáveis, seguindo exatamente o padrão de `techsales.leads`:

| Recurso                                | Ações                                | Escopos                                  |
| -------------------------------------- | ------------------------------------ | ---------------------------------------- |
| `techsales.prospecting.queue`          | view, create, update, delete, assign | workspace, team, own (assign: workspace) |
| `techsales.prospecting.cadences`       | view, create, update, delete         | workspace, own                           |
| `techsales.prospecting.questionnaires` | view, create, update, delete         | workspace, own                           |
| `techsales.prospecting.scoring`        | view, update                         | workspace                                |
| `techsales.prospecting.playbooks`      | view, create, update, delete         | workspace, own                           |
| `techsales.prospecting.enrichment`     | view, create, export                 | workspace                                |
| `techsales.prospecting.search`         | view, create, export                 | workspace                                |
| `techsales.prospecting.scripts`        | view, create, update, delete         | workspace, own                           |
| `techsales.prospecting.voice`          | view, update                         | workspace                                |

As 9 chaves `*.view` atuais são **mantidas** (menu, abas e permission sets em uso apontam para elas); as novas são aditivas, com `label_pt` em PT-BR. Nada é removido nem renomeado.

### 2. Matriz completa no diagnóstico

Adicionar `/prospecting` em `MENU_RESOURCES_BY_URL` com os 9 recursos acima. Com o catálogo do item 1, `/settings/rbac-diagnostics` passa a exibir Exibir / Criar / Editar / Excluir (e Exportar/Atribuir onde existir) com o combo de escopo por linha, como nas demais telas.

### 3. Visibilidade real das filas (migration)

Substituir a policy única de `prospecting_queues` por policies por comando, preservando o comportamento atual do dono:

- `SELECT`: dono **ou** (mesmo workspace **e** (`is_shared = true` **ou** o usuário tem `techsales.prospecting.queue.view.workspace`)).
- `INSERT`: `owner_id = auth.uid()` e exige `techsales.prospecting.queue.create.*`.
- `UPDATE`/`DELETE`: dono, **ou** quem tem a chave `...update.workspace` / `...delete.workspace` no mesmo workspace.

A checagem usa a função `public.user_has_permission` já existente, dentro de uma função `SECURITY DEFINER` para evitar recursão de RLS. Pertinência ao workspace via `current_user_workspaces`/`is_workspace_member`, já existentes.

### 4. Enforcement server-side

Em `src/lib/prospecting/queues.functions.ts`, aplicar `assertAnyPermission` (de `src/lib/access-control/enforce.server.ts`) nos handlers:

- `listQueues` / `listQueueItems` → `queue.view.{workspace,team,own}`
- `upsertQueue` (criar) → `queue.create.*`; (editar) → `queue.update.*`
- `addToQueue` / `removeFromQueue` → `queue.update.*`
- `deleteQueue` → `queue.delete.*`

Mesmo padrão, no mesmo escopo, para `cadences.functions.ts` e `questionnaires.functions.ts` (as abas que o marketing@ já vê).

### 5. UI coerente com a permissão

Em `src/components/prospecting/queue-tab.tsx` (e nos equivalentes de cadências/questionários):

- "Nova fila" só aparece com `queue.create.*`;
- "Editar fila"/"Excluir fila" só aparecem para o dono ou com `...update/delete.workspace`;
- badge "Compartilhada" nas filas com `is_shared`;
- texto de ajuda explícito no formulário: "Compartilhar com o workspace — os demais membros com permissão poderão visualizar e trabalhar esta fila".

O filtro "Todos os responsáveis" volta a aparecer automaticamente: ele vive no card de detalhe da fila selecionada, que não existia porque nenhuma fila era visível.

### 6. Liberar para o papel de vendedor

Após aprovado, incluir as novas chaves no permission set do papel do marketing@ em Configurações → Controle de acesso → Permissões (decisão sua sobre quais ações liberar; não faremos isso por migration).

## Detalhes técnicos

- Migrations: INSERT em `public.permissions`; funções auxiliares `SECURITY DEFINER`; policies de `public.prospecting_queues` (e revisão análoga em `prospecting_cadences`/`prospecting_questionnaires` se apresentarem o mesmo padrão owner-only).
- Código: `src/lib/menu-resources.ts`, `src/lib/prospecting/*.functions.ts`, `src/components/prospecting/queue-tab.tsx`.
- `listQueues` passa a retornar `owner_id` para a UI distinguir filas próprias de compartilhadas.
- Sem alteração de schema de dados, de autenticação, nem remoção de chaves existentes.

## Como validar

1. `/settings/rbac-diagnostics` → `/prospecting`: matriz com Exibir/Criar/Editar/Excluir e combos de escopo.
2. Liberar `queue.view.workspace` ao papel do marketing@ e marcar uma fila como compartilhada: a fila aparece para ele, com o filtro de Responsável.
3. Sem `queue.update.*`: botões de editar/excluir ausentes e a chamada direta ao server function retorna 403 registrado em `access_audit_log`.
4. Fila não compartilhada e sem `view.workspace` continua invisível.
