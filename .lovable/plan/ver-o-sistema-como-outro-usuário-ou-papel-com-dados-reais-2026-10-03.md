# Ver o sistema como outro usuário ou papel, com dados reais

## O que você vai ter
No topo do sistema aparece o seletor **"Ver como"**, disponível só para administradores. Ele tem dois grupos:
- **Usuários:** membros ativos do workspace.
- **Papéis:** os cargos de acesso, como Vendedor ou Representante de Vendas (externa).

Ao escolher uma opção, o sistema recarrega já com o acesso daquela pessoa ou daquele papel. Uma faixa fixa no topo avisa "Você está vendo como Fulano" e tem o botão **Voltar ao meu acesso**.

## Como cada opção funciona

**Ao escolher um usuário**
- Você passa a usar o sistema exatamente como a pessoa: mesmo menu, mesmos botões e **os mesmos registros**, filtrados pelas regras do banco.
- **Só leitura:** salvar, excluir, enviar mensagens, disparar workflows e qualquer outra gravação ficam bloqueados. Um aviso explica o motivo. Assim nada fica registrado em nome da pessoa.
- A pessoa não é desconectada e não recebe nenhum aviso.

**Ao escolher um papel**
- O sistema cria ou reaproveita um usuário de teste oculto para aquele papel, como "[Teste] Representante de Vendas (externa)", no workspace atual.
- Você vê os dados reais que o papel libera. Como é um usuário de teste, a carteira própria dele começa vazia: aparecem só os registros que o papel libera para todos e os vinculados a ele.
- Neste modo **é possível gravar**, para testar fluxos como criar um lead. Os registros ficam em nome do usuário de teste.
- Usuários de teste não aparecem nas listas de responsáveis, nos filtros, na contagem de licenças, nas notificações nem nos e-mails.

**Voltar ao meu acesso** devolve sua sessão sem pedir senha.

## Segurança
- Só proprietários e administradores do workspace podem usar o seletor. O servidor confere isso a cada troca.
- Não é possível ver como outro administrador ou proprietário, nem como alguém de outro workspace.
- A sessão "ver como" expira em 1 hora.
- Cada entrada, cada saída e cada gravação barrada ficam registradas no histórico de acessos: quem, como quem e quando.
- As regras de acesso do banco aos dados continuam as mesmas. O bloqueio de gravação é uma regra a mais.

## Validação
- Verificação automática do código (typecheck, lint e testes).
- Teste no navegador:
  1. Ver como Eduarda: confirmar que aparecem só as 4 empresas, o lead e os 3 negócios dela, e que tentar salvar é bloqueado.
  2. Ver como o papel Representante externa: criar um lead de teste.
  3. Voltar ao seu acesso: confirmar que você retorna à sua sessão e que o histórico registrou as trocas.

## Detalhes técnicos
- **Entrada como usuário:**
  - Uma nova server function `startViewAs({ user_id } | { role_id })` confere `assertOwnerOrAdmin` e se o alvo não é admin.
  - Com `supabaseAdmin` (importado dentro do handler), ela gera um magic link para o alvo. Para papel, primeiro cria ou reaproveita o usuário de teste.
  - Em seguida grava a sessão em `view_as_sessions (id, workspace_id, admin_id, target_user_id, mode 'user'|'role', read_only, expires_at, ended_at)`.
- **Cliente:**
  - Guarda a sessão do admin em sessionStorage.
  - Chama `verifyOtp` com o token do magic link para assumir o alvo.
  - `ViewAsBanner` + `endViewAs` restauram a sessão com `setSession`.
- **Bloqueio de gravação (modo usuário):**
  - Políticas RLS **restritivas** novas de INSERT/UPDATE/DELETE, via a função `is_read_only_view()`. A função consulta `view_as_sessions` ativa pelo `session_id` do JWT. Elas valem nas tabelas de negócio e são aditivas: não alteram as políticas existentes.
  - As server functions de envio (WhatsApp, e-mail) e de workflows também checam `is_read_only_view()`.
  - O cliente desativa os botões de gravação e mostra o aviso.
- **Banco (migrations aditivas):**
  - Tabela `view_as_sessions`, com GRANT e RLS (somente o admin dono lê).
  - Coluna `workspace_members.is_test_user boolean default false`.
  - Função `is_read_only_view()` e as políticas restritivas.
  - Exclusão de usuários de teste em `listWorkspaceMembers`, nos seletores de responsável, nas licenças e nas notificações.
- **Auditoria:** eventos `view_as_start`, `view_as_end` e `view_as_write_blocked` em `access_audit_log`.
- **Componentes:** `ViewAsSwitcher` no cabeçalho e `ViewAsBanner` no layout autenticado, com tokens semânticos.
