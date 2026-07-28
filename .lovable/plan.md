## Objetivo

Ao convidar um novo membro do workspace (Configurações → Controle de acesso → Membros → Convidar), o admin passa a **obrigatoriamente escolher um Conjunto de permissões (permission_set)**, além do papel base (admin/gestor/membro). Quando o convite é aceito, o conjunto escolhido é aplicado ao novo usuário automaticamente, substituindo o job_role fixo usado hoje.

Convites pendentes atualmente na fila (sem `permission_set_id`) serão revogados em massa (por workspace) — o admin recria-os já com a permissão definida.

## Escopo funcional

- Formulário de convite passa a exigir "Conjunto de permissões" (select carregado por workspace). Botão "Convidar" fica desabilitado enquanto não houver e-mail + papel + conjunto.
- Reenvio de convite continua funcionando, mas exige que o convite tenha `permission_set_id`. Convites antigos sem esse campo aparecem marcados como "Sem permissão — recrie" e o botão Reenviar fica desabilitado.
- Aceite do convite (`consumeInvite`): após criar o `workspace_members`, cria a atribuição do conjunto ao usuário (tabela de vínculo membro↔permission_set) e mantém o `user_job_roles` padrão apenas como fallback caso o `permission_set_id` esteja ausente.
- Lista de membros/convites mostra o conjunto atribuído em cada linha (nome do conjunto).
- Revogação em massa dos pendentes atuais: nova ação "Revogar todos os pendentes sem permissão" visível apenas para admin do workspace, com confirmação.

## Escopo técnico

### 1. Banco
Migração:
- Adicionar `permission_set_id uuid null` em `public.workspace_invites` (FK para `permission_sets(id) ON DELETE SET NULL`, index por workspace).
- Confirmar (ou criar, se ausente) a tabela de vínculo `member_permission_sets (workspace_id, user_id, permission_set_id, is_primary)` com RLS restringindo a admins do workspace e leitura pelo próprio usuário. Se já existir uma tabela equivalente (a verificar com read_query em `permission_sets`, `permission_set_items` e correlatas), reutilizar sem duplicar.
- Nenhuma mudança em `permission_sets` / `permission_set_items`.

### 2. Server functions (`src/lib/workspace-invites.functions.ts`)
- `createWorkspaceInvite`: adicionar `permission_set_id: z.string().uuid()` obrigatório no `inputValidator`. Validar que o `permission_set_id` pertence ao workspace ativo antes de inserir. Persistir na coluna nova.
- `listPendingTeamInvites` / `listTeamMembers`: retornar `permission_set_id` e `permission_set_name` (join com `permission_sets`).
- `resendWorkspaceInvite`: erro amigável se o convite não tiver `permission_set_id`.
- `consumeInvite`: após inserir em `workspace_members`, se `permission_set_id` existir, gravar em `member_permission_sets`. Manter o insert de `user_job_roles` como fallback apenas se `permission_set_id` for null.
- Novo `bulkRevokeInvalidWorkspaceInvites` (admin-only): deleta pendentes do workspace com `permission_set_id IS NULL`.

### 3. UI (`src/routes/_authenticated/settings.teams.tsx`)
- Dialog "Convidar": adicionar um `Select` "Conjunto de permissões" (obrigatório) alimentado pela query `permissionSets` já existente. Atualizar `canInvite` para exigir `permissionSetId`. Passar `permission_set_id` na chamada.
- Coluna nova em Membros e em Convites pendentes: "Permissões" (nome do conjunto).
- Convites pendentes sem conjunto: badge "Sem permissão — recrie" e botão Reenviar desabilitado com tooltip.
- Botão "Revogar pendentes sem permissão" no topo da lista de convites pendentes (aparece só se houver algum). Confirmação via `AlertDialog`.

### 4. Ajustes visíveis ao convidado
- Nenhum: a página `/accept-invite/$token` continua igual; a aplicação do conjunto ocorre no servidor.

## Fora do escopo

- Não alterar a matriz de permissões, `permission_sets`, `permission_set_items`, nem regras RLS de outras entidades.
- Não trocar o modelo de `role` (admin/manager/member) — ele continua obrigatório e mantém o comportamento atual.
- Não migrar/converter automaticamente permissões já atribuídas via `user_job_roles`.

## Validação manual

1. Configurações → Controle de acesso → Membros → Convidar: e-mail + papel selecionados, mas **sem** conjunto → botão "Convidar" desabilitado.
2. Selecionar um conjunto e convidar: convite criado, e-mail enviado, linha aparece na lista de pendentes exibindo o nome do conjunto.
3. Convites pendentes antigos aparecem com "Sem permissão — recrie" e botão de reenviar desabilitado; clicar em "Revogar pendentes sem permissão" remove todos após confirmação.
4. Aceitar um convite novo (fluxo `/accept-invite/$token`) e conferir na tela de matriz de permissões / cargos que o conjunto escolhido foi aplicado ao novo usuário.
5. Tentar criar convite passando um `permission_set_id` de outro workspace via chamada direta → server function rejeita.

## Riscos

- Se existir código legado que chama `createWorkspaceInvite` sem `permission_set_id` (scripts, testes), passará a falhar. Mitigação: buscar por chamadas remanescentes e ajustar.
- Convidados antigos que já aceitaram continuam com o `user_job_roles` fixo aplicado no passado; não haverá backfill automático — se necessário, o admin ajusta pelo diálogo "Cargos" existente.
