# Performance — Inbox unificada (parte C, 09/10/2026) — implementada no preview; não publicada

## Implementado
- `0095`/`0096`: `get_inbox_unified_page` (SECURITY INVOKER, só `authenticated`/`service_role`).
  Une e-mail, WhatsApp e chat; ordem global `(coalesce(last_message_at, created_at) desc, origem desc, id desc)`
  com cursor de três campos; busca (assunto, trecho, telefone, e-mail do visitante, nome/e-mail de contato
  e lead visíveis pela RLS; `%`/`_` escapados) **antes** da paginação; contagens exatas por canal
  (com a busca, independentes do canal escolhido) e total do canal escolhido.
- Último remetente: subconsulta `LIMIT 1` só para as linhas da página, com índice parcial
  `email_messages(thread_id, created_at desc) where direction='inbound'`. Antes baixava todas as mensagens
  das 150 threads.
- Cliente: `src/lib/inbox/unified-page.ts` (parser, junção sem duplicar, chave de cache por usuário/canal/busca)
  e `src/hooks/use-inbox-unified-page.ts` (`useInfiniteQuery`, `AbortSignal`, lista anterior visível durante
  nova busca). Cache por workspace/Ver como: já limpo nas trocas de identidade (ciclo 1).
- Realtime: `whatsapp_conversations` e `live_chat_sessions` (na publicação) → recarga agrupada em 400 ms das
  páginas abertas, sem voltar ao topo. `email_threads` **não** está na publicação; não foi adicionada
  (alto volume de sincronização) — e-mail reconcilia ao focar a aba.
- Tela: "Carregar mais (N de total)", contagens nos filtros, erro parcial visível mantendo a lista,
  conversa aberta continua aberta se sair das páginas carregadas, rascunho preservado. Só a Inbox
  unificada mudou; as telas por canal não foram alteradas nesta entrega.

## Validado
- Banco isolado local (PostgreSQL 16 descartável, `tests/sql/inbox-isolated-rls*.sql` + 0095/0096 reais):
  réplica das políticas SELECT reais com helpers simplificados; 181 e-mails, 170 WhatsApp, 160 chats com
  empates; role `authenticated` + claims sintéticas: 511 sem duplicar/perder em páginas de 37, ordenado;
  >150 por origem; busca acha item fora da 1ª página; último remetente; contagens; curingas;
  escopo próprio (nome de contato alheio não casa, mensagens de caixa alheia ocultas); equipe/workspace;
  tenant cruzado (só os 60 próprios); sem identidade → 0. 15/15 OK.
  Diferença do real: helpers (`current_user_workspaces`, `rep_*`, `is_test_record`, admin) simplificados.
- `unified-page.test.ts` (4). Navegador autenticado (dev, somente leitura, conta do solicitante):
  1 chamada de 32 KB, lista em 6,0 s no Vite dev; "Todos (7473)", "Carregar mais" até 200; busca vazia
  mostra estado vazio. Nenhuma mensagem enviada ou marcada como lida.
- Sem medição "antes" sob as mesmas condições; não é medida de produção.

## Gates
tsgo exit 0; ESLint arquivos alterados exit 0 (aviso de tamanho em `inbox.index.tsx`); vitest exit 0
(100 arquivos/678); build exit 0 em 139 s numa amostra (sem conclusão de ganho), entrada 1.047,11 KB.
Verificação automática de 240 s: comando continua inacessível; causa não determinada.

## Pendente
- RLS não-admin no banco real; telas `/inbox/email|whatsapp|chat` ainda com consultas próprias;
  realtime de e-mail; medição comparável.

## Rollback
Reverter `inbox.index.tsx` e remover o hook; a função e o índice são aditivos e podem ficar.
