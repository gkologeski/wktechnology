# Excluir 2+ contatos: botão de exclusão em massa não aparece

## Causa confirmada

O botão "Excluir" da barra de seleção em `/contacts` tem dois gates:

1. `can("bulk_delete")` do hook legado `useMyTools`;
2. `<Can permission="techsales.contacts.delete.workspace">` (RBAC atual).

Verificado no banco para `guilherme@wktechnology.com.br`:

- RBAC atual: `user_has_permission(..., 'techsales.contacts.delete.workspace')` = **true**;
- workspace ativo é um workspace real (`workspace_members` = 1 linha);
- `team_members` com `workspace_owner_id = active_workspace_id` = **0 linhas**.

`useMyTools` ainda usa o modelo antigo (workspace = id do usuário dono + tabela
`team_members` + `access_profile_tools`). Como o workspace ativo não é o próprio
usuário e não existe linha em `team_members`, o hook marca **todas** as tools como
`false` — inclusive `bulk_delete`. Resultado: o botão nunca é renderizado, mesmo
com permissão concedida. A política RLS de exclusão está correta e não há FK
bloqueando a exclusão.

Impacto igual em outras telas que usam o mesmo gate legado: `/contacts`
(`export` e `bulk_delete`), `/companies` e `/tickets`.

## Correção proposta

1. **Alinhar `useMyTools` ao modelo de workspace atual** (`src/lib/use-my-tools.ts`):
   - resolver o workspace ativo e verificar participação via `workspace_members`;
   - ler as tools do perfil de acesso vinculado ao membro no workspace atual
     (mantendo `access_profile_tools` quando existir);
   - quando o usuário é membro do workspace e não há perfil legado definido,
     **não zerar** todas as tools — manter o padrão permissivo e deixar a decisão
     final para o RBAC granular (`Can` + RLS), que é a fonte de verdade.
2. **Remover o gate legado redundante** nos botões de exclusão em massa de
   Contatos, Empresas e Chamados, mantendo apenas `<Can permission="...delete.workspace">`.
   Assim a UI passa a refletir exatamente a permissão configurada em
   `/settings/permissions`.
3. Manter intactos: fluxo de exclusão (`ConfirmDialog` + `.select("id")` +
   `deniedIfUnaffected`), RLS, schema e regras de negócio.

## Detalhes técnicos

- Arquivos previstos: `src/lib/use-my-tools.ts`,
  `src/routes/_authenticated/contacts.tsx`, `.../companies.tsx`, `.../tickets.tsx`.
- Sem migration, sem alteração de política RLS, sem novas dependências.
- Segurança preservada: a exclusão continua barrada pela política
  `ws_delete_contacts` (workspace + `techsales.contacts.delete.workspace`), e a UI
  segue usando `deniedIfUnaffected` para não mostrar sucesso falso.

## Validação

- `bun run typecheck`, `bun run lint`, `bun run test`.
- Manual em `/contacts`: selecionar 2+ contatos → botão "Excluir" visível →
  confirmar → registros removidos e grid atualizado.
- Manual com usuário sem a permissão de exclusão: botão ausente; se a exclusão
  for tentada por outro caminho, aviso de permissão negada.
