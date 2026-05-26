# Perfis de acesso configuráveis

Transformar `/settings/roles` em um gerenciador completo de perfis de acesso, no estilo do HubSpot dos anexos: o admin cria perfis personalizados, escolhe permissões por objeto (Contatos, Empresas, Leads, Negócios, Tickets, Tarefas, etc.) com escopo (Nenhum / Próprios / Equipe / Todos), e ferramentas extras (importar, exportar, exclusão em massa, comunicar, etc.). Cada membro do workspace passa a ter um perfil atribuído.

## O que muda

- Hoje só existem 3 papéis fixos (admin / gestor / membro).
- Passa a existir uma tabela de **perfis de acesso** por workspace, totalmente editáveis.
- Cada perfil guarda um **conjunto de permissões granular** (objeto + ação + escopo + flags de ferramentas).
- Os perfis padrão (Admin, Gestor, Membro) ficam pré-criados e marcados como "sistema" (não podem ser excluídos, podem ser duplicados).

## Telas

### `/settings/roles` (lista de perfis)
- Tabela com: nome do perfil, descrição, nº de usuários, badge "Sistema" / "Personalizado", ações (editar, duplicar, excluir).
- Botão **"Criar perfil"** (em branco) e **"Duplicar"** (clona um existente).
- Atribuição de perfil por usuário também aparece aqui (com mesma UX atual de Select por linha do membro).

### `/settings/roles/$roleId` (editor do perfil)
Layout em duas colunas, inspirado no HubSpot:

```text
+--------------------------------------------------------------+
| Editando perfil: [Nome editável]              [Cancelar][Salvar]
+----------------+---------------------------------------------+
| Categorias     |  Permissões                                 |
| - CRM          |  Contatos                                   |
|   - Objetos    |    Visualizar:  [Todos ▼]                   |
|   - Ferramentas|    Editar:      [Próprios ▼]                |
| - Marketing    |    Criar:       [LIGADO]                    |
| - Vendas       |    Excluir:     [Equipe ▼]                  |
| - Atendimento  |  Empresas                                   |
|                |    ...                                      |
+----------------+---------------------------------------------+
```

- **Sidebar** com as categorias (CRM › Objetos / Ferramentas, Marketing, Vendas, Atendimento, Relatórios, Conta).
- **Conteúdo** mostra cada objeto/ferramenta com seus controles.
- Escopo padrão por ação: `nenhum | proprios | equipe | todos`.
- Ferramentas (booleanos): `comunicar`, `importar`, `exportar`, `exclusao_em_massa`, `gerenciar_workflows`, `gerenciar_propriedades`, `gerenciar_pipelines`, `acessar_logs`, `gerenciar_integracoes`, `gerenciar_billing`, `gerenciar_usuarios`.

## Objetos cobertos
Contatos, Empresas, Leads, Negócios, Tickets, Tarefas, Notas, Chamadas, Reuniões, E-mails, Atividades, Produtos, Cotações.

## Banco de dados

Três tabelas novas (por workspace, com RLS):

- `access_profiles` — perfis configuráveis
  - nome, descrição, is_system (bool), is_default (bool)
- `access_profile_permissions` — permissões por objeto
  - perfil_id, object_key, view_scope, edit_scope, create_enabled, delete_scope
- `access_profile_tools` — flags de ferramentas
  - perfil_id, tool_key, enabled

A tabela `team_members` ganha `access_profile_id` (referência ao perfil).
A coluna `role` antiga continua existindo para compatibilidade (mapeada automaticamente a partir do perfil escolhido: admin/manager/member).

Seed automático na primeira abertura do workspace: cria os 3 perfis de sistema (Admin, Gestor, Membro) com as permissões equivalentes ao comportamento atual.

## Server functions novas (`src/lib/access-profiles.functions.ts`)
- `listAccessProfiles()` — lista perfis + contagem de usuários.
- `getAccessProfile(id)` — perfil + todas as permissões e ferramentas.
- `createAccessProfile({ name, description, copyFrom? })` — cria perfil (opcionalmente duplicando outro).
- `updateAccessProfile({ id, name, description, permissions, tools })` — salva tudo num único call.
- `deleteAccessProfile(id)` — bloqueia se for sistema ou se houver usuários atribuídos.
- `assignProfileToUser({ user_id, profile_id })` — substitui o Select de papel atual.

## Aplicação das permissões
Hook `useAccessPermissions()` no frontend (consulta o perfil do usuário logado uma vez por sessão) que expõe:
- `can(object, action, recordOwnerId?)` → boolean, considerando escopo.
- `tool(toolKey)` → boolean.

Componentes existentes que escondem botões por papel passam a usar esse hook (botão Excluir, Importar, etc.). Esta primeira iteração foca em **definir e gravar** as permissões; a aplicação em todas as telas é incremental — começamos pelos pontos óbvios (botões de excluir, exportar, importar, configurações).

## Detalhes técnicos

- Migration única cria as 3 tabelas + RLS (apenas admin do workspace lê/escreve perfis; membros leem o próprio perfil).
- Trigger de seed roda no primeiro acesso de um workspace que ainda não tem perfis.
- `assignProfileToUser` continua espelhando `user_roles.role` para manter políticas SQL existentes funcionando (admin/manager/member derivado).
- Página atual `/settings/roles` é totalmente reescrita.
- Rota nova `/settings/roles/$roleId` para o editor.

## Fora de escopo desta entrega
- Aplicar a checagem `can()` em **todas** as telas/endpoints existentes (vai sendo feito conforme cada tela for tocada).
- Permissões por propriedade (field-level) — fica para uma próxima.
- Permissões de relatórios/dashboards individuais — fica para uma próxima.

Confirma que posso seguir com essa abordagem?
