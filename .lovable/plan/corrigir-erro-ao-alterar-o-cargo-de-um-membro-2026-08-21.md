# Corrigir erro ao alterar o cargo de um membro

## Diagnóstico (verificado)

A tabela `user_job_roles` tem a coluna `workspace_id` **obrigatória** (não aceita valor nulo), mas a função que salva os cargos de um membro na tela Configurações → Equipe grava apenas `user_id`, `owner_id`, `role_id` e `is_primary`. Sem o workspace, o banco recusa a gravação — daí a mensagem de erro.

O mesmo problema existe no fluxo de aceite de convite, que atribui o cargo padrão ao novo membro também sem informar o workspace. Já a tela de permissões (`/settings/permissions`) grava corretamente com o workspace, por isso funciona.

Em `user_permission_sets` a coluna de workspace é opcional, então ali não há erro — mas vale preencher para manter o isolamento consistente.

## O que será feito

1. Ao salvar cargos de um membro em Configurações → Equipe, passar o workspace ativo junto com os demais dados.
2. Fazer o mesmo no aceite de convite, ao atribuir o cargo padrão do novo membro.
3. Preencher o workspace também nos pacotes de permissão extra desses dois fluxos, para manter o isolamento uniforme.
4. Nenhuma mudança de schema, RLS, regra de negócio ou interface.

## Detalhes técnicos

- `src/lib/teams.functions.ts` → `setMemberJobRoles`: incluir `workspace_id: workspace.id` nas linhas de `user_job_roles` e `user_permission_sets`; manter `owner_id` como está (as políticas dependem dele) e manter os `delete` por `owner_id + user_id`.
- `src/lib/workspace-invites.functions.ts` (aceite de convite): incluir `workspace_id: inv.workspace_id` no insert de `user_job_roles` e no de `user_permission_sets`.

## Validações

- `bun run typecheck` e `bun run lint`.
- Alterar o cargo da Andressa para admin do workspace em `/settings/teams` e confirmar sucesso, checando no banco que a linha em `user_job_roles` tem workspace preenchido.
