# Performance — ciclo 5 (09/10/2026): telas por canal da Inbox + tempo real de e-mail — preview, não publicado

Base: 1b77ab5. Unificada (0095/0096) não foi refeita, só ganhou o tempo real de e-mail.

## Implementado
- Migração `0097_inbox_channel_page_email_realtime.sql` (aditiva):
  - `get_inbox_channel_page(canal, responsável, busca, workspace, cursor_at, cursor_id, tamanho)`,
    SECURITY INVOKER, só `authenticated`/`service_role`. Ordem `(coalesce(last_message_at, created_at) desc, id desc)`.
    Filtro Minhas/Sem dono/Todas e busca **antes** da paginação; contagens exatas das três abas com a busca;
    projeção = exatamente os campos que cada tela já usava. Chat mantém o filtro pelo workspace ativo
    (`owner_id`), via server fn `listInboxChannelPage`.
  - `ALTER PUBLICATION supabase_realtime ADD TABLE public.email_threads` (só essa tabela).
- Contrato de busca: campos de resumo (assunto, trecho, telefone, prévia, visitante, nome/e-mail de contato e lead
  visíveis). Corpo das mensagens não é pesquisado — antes as telas por canal não tinham busca.
- Telas `/inbox/email`, `/inbox/whatsapp`, `/inbox/chat`: mesmas ações, layouts e componentes; antes cortavam em 200
  conversas e filtravam responsável no navegador. Agora: busca, contagens nas abas, "Carregar mais (N de total)",
  erro parcial visível com a lista mantida, vazio só quando realmente vazio, conversa aberta continua aberta fora das
  páginas carregadas (instantâneo da linha).
- Tempo real (`useRealtimeInvalidate`: agrupamento 250 ms/1 s, reconciliação ao reconectar e ao voltar à aba, canal
  por usuário): e-mail filtrado por `account_id=in.(caixas do próprio usuário)`; WhatsApp e chat pela tabela de
  conversas. As assinaturas duplicadas de lista dentro das telas foram removidas (só mensagens continuam lá).
  Threads visíveis por contato de caixas de outras pessoas reconciliam ao focar/reconectar. DELETE com payload
  incompleto recarrega por segurança.
- WhatsApp: histórico agora traz as **500 mais recentes** (antes as 500 mais antigas, escondendo as novas).

## Validado
- Banco isolado local (PostgreSQL 16 descartável; `tests/sql/inbox-channel-isolated*.sql` + 0097 real): 181 e-mails,
  170 WhatsApp, 160 chats com empates; sem duplicar/perder; Minhas/Sem dono paginados = contagens; projeção; busca
  fora da 1ª página; "Minhas" depende do usuário; chat de outro workspace 0; outro tenant só os próprios; canal
  inválido rejeitado — TODOS OK, junto com as 15 asserções da unificada. Mesma simplificação de helpers do ciclo 4.
- Testes: `channel-page.test.ts` (9, inclui eventos sintéticos de realtime: outra caixa ignorada, própria caixa
  recarrega, DELETE incompleto recarrega, rajada de 30 → 1 recarga).
- Navegador (dev, conta do solicitante, somente leitura, nenhuma conversa aberta no WhatsApp para não marcar lida):
  Email "Todas 7489", carregou até 250, abriu a 221ª conversa (antes inalcançável), busca "Pix" 155 e filtro
  "Sem dono" mantendo a busca; WhatsApp 8 (4/2), Chat 2 (2/0). Sem erros no console.

## Métricas (Vite dev, mesma máquina, mesma conta)
| Tela | Antes: lista | Depois: lista | Visível frio/quente antes → depois |
| --- | --- | --- | --- |
| Email | 200 threads, 140.835 B (corte silencioso) | 50 por página, 38.404 B + 47 B (caixas) | 3,4/3,1 s → 4,1/3,1 s |
| WhatsApp | 5.456 B | 6.128 B | 3,6/3,1 → 4,0/3,0 s |
| Chat | 1.322 B | 1.667 B | 3,2/3,2 → 3,4/3,3 s |
Tempo de dev não indica produção; não houve ganho de tempo demonstrado, só menos bytes no e-mail e fim do corte.

## Gates
tsgo exit 0; ESLint dos alterados 0 erros (avisos preexistentes de tamanho/console); vitest exit 0 (101 arquivos /
687 testes); build exit 0 em 141 s (amostra única), entrada 1.047,13 KB. Timeout de 240 s da plataforma: sem
comando/log novo — causa continua não determinada.

## Pendente / limitações
- RLS de perfis não-admin e outro tenant no **banco real**: não validado (sem sessão de terceiros; SET ROLE negado).
  Requisito para publicar.
- Entrega real de evento de e-mail não demonstrada (exigiria gravar em `email_threads` compartilhada).
- Histórico dentro da conversa: e-mail e chat continuam sem limite (máx. atual 28 e 4 mensagens); WhatsApp limitado
  às 500 mais recentes sem "carregar anteriores" (máx. atual 43).
- Polling de 10 s da lista de chat foi substituído por tempo real + reconciliação.
- Seleção por URL não existia nas telas por canal e não foi criada.

## Rollback
Reverter as três telas, os hooks e `whatsapp.functions.ts`; a função 0097 fica sem uso. Para o tempo real de e-mail:
`ALTER PUBLICATION supabase_realtime DROP TABLE public.email_threads` em janela administrativa.
