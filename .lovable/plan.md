# Plano: Atribuição de cargos na tela de Membros

## Contexto
Hoje o workspace tem três telas de controle de acesso:
- **Membros (`/settings/teams`)**: quem tem acesso ao workspace e o papel do workspace (`admin`/`manager`/`member`).
- **Times (`/settings/user-groups`)**: agrupamentos nomeados de membros para organização.
- **Permissões (`/settings/permissions`)**: cargos funcionais (`job_roles`) e a matriz de permissões por módulo.

A relação prática é: ao aceitar um convite, o sistema mapeia automaticamente o papel do workspace para um `job_role` padrão (`member` → Vendedor, `manager` → Gestor, `admin` → Admin). A partir daí, as permissões editadas em `/settings/permissions` afetam esses cargos. Porém, **não existe na UI um lugar para o administrador escolher manualmente qual `job_role` cada membro terá**.

## Objetivo
Permitir que um admin do workspace visualize e edite o cargo principal e os cargos extras de cada membro diretamente em `/settings/teams`, sem sair da tela.

## O que será construído

### 1. Dados: listar cargos atuais dos membros
- Estender `listTeamMembers` em `src/lib/teams.functions.ts` para também retornar, para cada membro:
  - `primary_role_id`
  - `role_ids` (todos os cargos, incluindo o primário)
  - `extra_set_ids` (pacotes extras avulsos)
- Buscar esses dados de `public.user_job_roles` e `public.user_permission_sets` usando `supabaseAdmin` (já que as políticas RLS de `user_job_roles` restringem leitura ao próprio usuário/dono e a tela de admin precisa ver todos).

### 2. Dados: listar cargos disponíveis
- Criar server function `listWorkspaceJobRoles` em `src/lib/teams.functions.ts` que retorne os `job_roles` do workspace (sistema + customizados) para preencher o seletor.

### 3. Persistência: salvar atribuições
- Reaproveitar `setMemberAssignments` de `src/lib/access-control/access-mutations.functions.ts`.
- **Atenção**: a política RLS atual de `user_job_roles` (`ujr_write`) exige `owner_id = auth.uid()`, ou seja, apenas o criador do workspace pode editar. Como `/settings/teams` permite que qualquer `admin` do workspace gerencie membros, será necessário ajustar a política para permitir que workspace admins também gerenciem atribuições, **ou** executar a escrita via `supabaseAdmin` após verificar que o usuário logado é admin do workspace.
- Decisão recomendada: manter a consistência com a tela de membros e permitir que qualquer workspace admin atribua cargos, validando a permissão no server function e usando `supabaseAdmin` para escrita (o mesmo padrão já usado em `teams.functions.ts` para gerenciamento de membros).

### 4. UI: exibir cargos na lista
- Adicionar uma coluna "Cargo(s)" na tabela de membros em `src/routes/_authenticated/settings.teams.tsx`.
- Exibir o nome do cargo principal como badge; se houver cargos extras, mostrar `+N`.

### 5. UI: diálogo de edição de cargos
- Adicionar botão de ação "Cargos" (ou ícone) em cada linha da tabela.
- Abrir um diálogo com:
  - Select de "Cargo principal" (opcional).
  - Lista de checkboxes de "Cargos adicionais".
  - Lista de checkboxes de "Pacotes extras" (opcional, reaproveitando o mesmo modelo de `MemberAssignmentDialog`).
- Usar `useMutation` com otimistic update e invalidação de cache.

### 6. UX e acessibilidade
- Desabilitar a edição para o próprio usuário logado? Não necessariamente, mas avaliar se faz sentido.
- Garantir labels/aria-labels, estados de loading e feedback de erro.
- Manter responsividade: em telas menores, o diálogo deve funcionar bem.

### 7. Validações
- Typecheck (`bunx tsc --noEmit` ou comando do projeto).
- Build.
- Teste manual: convidar um membro, alterar seu cargo principal para outro `job_role`, verificar se as permissões refletem imediatamente.

## Arquivos que serão alterados
- `src/lib/teams.functions.ts` — novas queries e server functions.
- `src/routes/_authenticated/settings.teams.tsx` — coluna de cargo, botão e diálogo de edição.
- `src/lib/access-control/access-mutations.functions.ts` — possível ajuste na validação de admin (se necessário).
- Possível migration para ajustar RLS de `user_job_roles` (a decidir durante implementação).

## Riscos e pendências
- A política RLS `ujr_write` restringe escrita ao `owner_id`. Se optarmos por ajustar a política, precisamos garantir que não abra brecha de segurança.
- A tabela `user_job_roles` usa `owner_id` como o `auth.uid()` do criador do workspace, não o `workspace_id`. Isso é um modelo legado que pode exigir cuidado na escrita via `supabaseAdmin`.
- Não alteraremos a tela de Times nem a de Permissões, apenas a integração entre Membros e Permissões.