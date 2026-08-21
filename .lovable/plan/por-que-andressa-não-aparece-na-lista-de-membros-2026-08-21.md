# Por que andressa@ não aparece na lista de membros

## Diagnóstico (verificado no banco)

- A conta existe: `andressa@wktechnology.com.br`, criada em 20/07/2026, e-mail confirmado, último acesso em 21/07/2026.
- Existe o perfil dela (`profiles`), com nome "Andressa Wolf Kologeski", mas **`active_workspace_id` está nulo**.
- Ela **não tem nenhum vínculo de workspace**: nenhuma linha em `workspace_members`, nenhuma em `team_members` (estrutura legada) e nenhum convite em `workspace_invites` (os 5 convites existentes são de outras pessoas).
- Existe apenas um workspace ("WK Technology") com 9 membros em `workspace_members` e 4 vínculos legados em `team_members`.
- A lista de membros (`listWorkspaceMembers`) monta os nomes a partir de `workspace_members` + `team_members` + criador do workspace. Sem vínculo, ela é invisível para o sistema todo — não é bug de exibição, é ausência de vínculo.

Causa raiz provável: a conta foi criada por cadastro direto (sign-up), não por convite. O cadastro cria `auth.users` + `profiles`, mas o vínculo de workspace só é criado quando há convite pendente para aquele e-mail (`consume_workspace_invites_on_confirm`). Sem convite, a conta fica órfã: entra no sistema mas sem workspace, sem permissões e sem aparecer em nenhuma lista.

## O que será feito

1. **Vincular a Andressa ao workspace WK Technology**
   - Criar a linha em `workspace_members` com papel `member`.
   - Definir `profiles.active_workspace_id` para o workspace WK Technology, para que o app carregue os dados dela ao entrar.
   - Atribuir o perfil de acesso (access profile) que você indicar — sem isso ela entra sem permissão nenhuma e verá telas vazias.

2. **Detectar outras contas órfãs**
   - Verificar se há outros usuários com perfil mas sem vínculo de workspace e listar para você decidir caso a caso (não vincular automaticamente).

3. **Evitar recorrência (prevenção)**
   - Na tela de cadastro/primeiro acesso: quando o usuário confirma o e-mail e não há convite nem workspace vinculado, exibir um estado explícito de "conta sem workspace — solicite convite ao administrador" em vez de deixá-lo em um app vazio.
   - Em Configurações → Equipe, exibir uma seção de "contas sem vínculo" com o mesmo domínio de e-mail do workspace, permitindo ao admin vincular com um clique e escolher o perfil de acesso.

## Detalhes técnicos

- Inserção em `public.workspace_members` (`workspace_id`, `user_id`, `role`) + `update public.profiles set active_workspace_id`.
- Perfil de acesso via `user_access_profiles`/`user_job_roles` conforme o padrão já usado no convite de membros (mesma lógica do fluxo de aceite de convite, para não divergir).
- A prevenção no cadastro é apenas UI/estado (sem alterar RLS, schema de auth ou triggers de `auth`).
- Nenhuma política RLS será alterada nesta tarefa.

## Como validar depois

1. Andressa faz login: deve cair no workspace WK Technology com o menu carregado conforme o perfil atribuído.
2. Em Configurações → Equipe e nos seletores de responsável, o nome "Andressa Wolf Kologeski" deve aparecer.
3. Consultar no banco que existe a linha em `workspace_members` e que `active_workspace_id` está preenchido.

## Decisão necessária antes de executar

Qual perfil de acesso ela deve receber (ex.: o mesmo de outra pessoa da equipe) e se o papel no workspace é `member` ou `admin`.
