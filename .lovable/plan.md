# Corrigir erro ao salvar tarefa atribuída a outra pessoa

## O que está acontecendo

Ao criar uma tarefa na timeline do lead e escolher outra pessoa como responsável (Cristiane Menezes), o sistema grava essa pessoa como **dono** do registro em vez de gravá-la como **responsável**. A regra de segurança do banco exige que o dono do registro seja quem está criando — por isso aparece "new row violates row-level security policy for table activities" e a tarefa não é salva.

Verificado na base: a política de inserção de atividades exige `owner_id = usuário autenticado`; o código de criação da timeline envia `owner_id = pessoa escolhida`.

Com isso, hoje só é possível criar tarefa para si mesmo.

## Correção

1. Na criação da tarefa pela timeline: o criador continua como dono e a pessoa escolhida passa a ser gravada no campo de **responsável**. A tarefa aparece corretamente na lista de tarefas abertas da pessoa atribuída.
2. Na edição de uma tarefa existente: trocar o responsável passa a alterar o campo de responsável, não o dono.
3. A menção (@Cristiane) e a notificação continuam funcionando como hoje.
4. Mensagem de erro amigável em pt-BR caso a pessoa realmente não tenha permissão para criar atividades.

Nada de esquema, políticas de segurança ou permissões é alterado.

## Detalhes técnicos

- `src/components/activity-timeline.tsx` (função `add`): `owner_id: user.id` sempre; `assigned_to: type === "task" && assigneeId ? assigneeId : user.id`.
- `src/components/activity/use-activity-editing.ts`: `patch.assigned_to` em vez de `patch.owner_id`.
- O gatilho `sync_responsible_columns` já espelha `assigned_to` em `assigned_user_id`, e `set_workspace_on_insert` continua resolvendo o workspace — nenhuma migration necessária.
- Tratar erro com `handlePermissionError` / `isPermissionDeniedError` já existentes.
- Validação: `bun run typecheck`, `bun run lint` nos arquivos alterados e `bun run test`; teste manual criando tarefa atribuída a outro usuário.
