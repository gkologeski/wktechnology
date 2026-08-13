# Por que cristiane.menezes@ não consegue qualificar um lead

## Causa confirmada

A qualificação em si é gravada (a policy de `prospecting_qualifications` só exige `owner_id = auth.uid()`), mas o passo final — gravar a etapa/campos do lead — é bloqueado pelo RLS de `leads`.

O UPDATE de `leads` usa `user_can_act('leads','edit', owner_id, assigned_user_id)`, que consulta apenas o modelo **legado** de perfis de acesso:

- `user_can_act` chama `user_scope_for(auth.uid(), lead.owner_id, 'leads', 'edit')`;
- essa função só devolve escopo se existir linha em `team_members` com `access_profile_id` preenchido e uma regra em `access_profile_permissions` para o objeto `leads`;
- verificado: a Cristiane tem `team_members.access_profile_id = NULL` no workspace WK Technology → escopo `NULL` → `false`.

Ela é `admin` em `workspace_members` e o modelo novo (`user_effective_permissions`) devolve 1.648 chaves para ela, incluindo `techsales.leads.update.*` — mas o RLS de `leads` não consulta esse modelo. Resultado: só o dono do workspace consegue editar leads; qualquer outro usuário sem perfil de acesso legado falha, mesmo sendo admin. Os leads dela são dela (`owner_id` e `assigned_user_id` = ela), então não é questão de propriedade.

## Correção proposta

1. **Alinhar `user_can_act` ao RBAC atual** (migração): antes de cair no modelo legado, considerar
   - dono do workspace / `is_platform_admin` → `all` (já existe);
   - `is_workspace_admin_of(workspace, auth.uid())` → `all`;
   - `user_has_permission(..., '<module>.<object>.<action>.workspace|team|own')` → escopo correspondente;
   - somente se nada disso resolver, usar `access_profiles` (compatibilidade).

   Assim `leads`, e todas as tabelas que usam `user_can_act`, passam a respeitar a matriz de `/settings/permissions`.

2. **Escopo `own` mais tolerante**: hoje `own` exige `assigned_user_id = auth.uid()`; passar a aceitar `owner_id = auth.uid()` também, senão um lead criado sem responsável fica ineditável pelo próprio criador.

3. **Erro visível na UI**: o painel de qualificação hoje pode terminar sem aviso quando o UPDATE do lead não afeta nenhuma linha (RLS não gera erro). Passar a detectar 0 linhas afetadas e mostrar toast de permissão negada (`handlePermissionError`), em vez de fechar como se tivesse salvo.

4. **Complemento operacional** (sem migração): atribuir um perfil de acesso à Cristiane em `team_members`/`/home/access`, útil como mitigação imediata.

## Detalhes técnicos

- Migração alterando `public.user_scope_for` (ou `user_can_act`) mantendo assinatura, `SECURITY DEFINER` e `search_path`. Nenhuma policy precisa ser recriada.
- Mapeamento de ação → chave: `view|edit|delete` → `.view|.update|.delete` com sufixos `.workspace`/`.team`/`.own`, usando o prefixo de módulo já existente em `permissions` para cada objeto.
- UI: `src/components/prospecting/qualification-panel.tsx` (e o mesmo caminho usado pelo modal de pesquisa de Vendas) passa a usar `.select('id')` no update do lead e tratar retorno vazio como permissão negada.
- Sem mudança de schema, de decisão de score ou de fluxo de qualificação.

## Como validar

1. Logar como cristiane.menezes@ e mover um lead dela para "Qualificado" → questionário abre, "Qualificar" grava e a etapa persiste após recarregar.
2. Repetir com um lead de outro responsável: deve funcionar se ela tiver escopo workspace/team, e mostrar toast de permissão negada caso contrário.
3. Conferir que o dono do workspace continua com acesso total e que um usuário sem nenhuma permissão de leads continua bloqueado.
