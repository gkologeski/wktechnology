# Ver o sistema como outro usuário ou papel

## O que você vai ter
No topo do sistema, só para administradores, aparece o seletor **"Ver como"**. Ele tem dois grupos:
- **Usuários:** membros do workspace.
- **Papéis:** os cargos de acesso, como Vendedor ou Representante de Vendas (externa).

Ao escolher uma opção, o sistema recarrega. Uma faixa fixa no topo avisa "Você está vendo como Fulano" e tem o botão **Voltar ao meu acesso**.

## Como cada opção funciona

**Ao escolher um usuário (só menus e botões)**
- O menu, os módulos e os botões (criar, editar, excluir, exportar) passam a seguir as permissões dessa pessoa.
- Os dados exibidos continuam sendo os seus. A faixa avisa isso: "Os registros mostrados são os do seu acesso".
- Nada muda no banco. É só a forma de mostrar as telas.

**Ao escolher um papel (usuário de teste)**
- O sistema cria ou reaproveita um usuário de teste oculto para aquele papel, como "[Teste] Representante de Vendas (externa)", no workspace atual.
- Você entra com esse usuário de verdade. Menus, botões **e dados** aparecem exatamente como as regras do papel permitem.
- "Voltar ao meu acesso" devolve sua sessão sem pedir senha.
- Usuários de teste não aparecem nas listas de responsáveis, nos filtros nem na contagem de licenças. Também não recebem e-mails nem notificações.
- Se você salvar algo nesse modo, o registro fica gravado como criado pelo usuário de teste.

## Segurança
- Só proprietários e administradores do workspace veem o seletor. O servidor confere isso a cada troca.
- Cada entrada e cada saída fica registrada no histórico de acessos: quem, como quem e quando.
- O usuário de teste só pertence ao workspace atual e não tem senha conhecida.
- As regras de segurança do banco não mudam.

## Fora do escopo
- Ver os dados reais de uma pessoa específica. Você escolheu só menus e botões para usuários.
- Bloquear gravações no modo de papel.

## Validação
- Typecheck, lint e testes.
- Teste no navegador: escolher a Eduarda e ver o menu ficar reduzido. Escolher o papel Representante externa e ver só a carteira do usuário de teste, que deve estar vazia. Voltar ao seu acesso.

## Detalhes técnicos
- **Modo usuário:**
  - Um provedor de "visão" no cliente guarda `{ kind: "user", userId }` em sessionStorage.
  - `getMyPermissions` e `module-access` passam a aceitar `view_as_user_id`. O servidor valida `assertOwnerOrAdmin` e devolve `user_effective_permissions` do alvo.
  - `app-sidebar` e os botões que usam o hook de permissões passam a seguir essa visão.
- **Modo papel:**
  - Uma nova server function `startRoleView(role_id)` (admin verificado) usa `supabaseAdmin` para criar ou reutilizar o usuário de teste. Ela grava `workspace_members`, `user_job_roles` e uma marca `is_test_user`, e gera um magic link.
  - O cliente salva a sessão do admin em sessionStorage e chama `verifyOtp` com o token do magic link.
  - `endRoleView` restaura a sessão salva com `setSession`.
- **Banco (migration aditiva):**
  - Coluna `workspace_members.is_test_user boolean default false`.
  - Os filtros de membros (`listWorkspaceMembers`, seletores de responsável, contagem de licenças, notificações) passam a excluir usuários de teste.
- **Auditoria:** registra os eventos `view_as_start` e `view_as_end` em `access_audit_log`.
- **Componentes:**
  - `ViewAsSwitcher` no cabeçalho.
  - `ViewAsBanner` no layout autenticado, com tokens semânticos.
