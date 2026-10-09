# Performance — ciclo 6 (09/10/2026): histórico de mensagens paginado + robustez do tempo real — preview, não publicado

Ciclo 5 continua implementado no preview, não validado em produção.

## Implementado
- `src/lib/inbox/message-history.functions.ts`:
  - `listConversationMessages(canal, conversa, before|after, limite≤100)`: sob RLS do usuário (chat também
    restrito ao workspace ativo). Cursor `(created_at, id)` validado (formato de data + UUID, valores entre aspas no
    filtro). Primeira página = mais recentes (e-mail 20, WhatsApp 50, chat 50), `limit+1` para `hasMore`.
  - Projeções: e-mail sem `body_html/body_text/attachments`; WhatsApp e chat com todos os campos que os cartões
    já usavam (status, recibos, mídia, template).
  - `getEmailThreadMeta` (cabeçalho) e `getEmailMessageBody` (corpo/anexos por mensagem).
- `src/lib/inbox/message-history.ts`: chave de tempo com microssegundos (aceita formato do PostgREST e do tempo
  real), junção sem duplicar, redutor que descarta respostas de outro contexto.
- `src/hooks/use-message-history.ts`: troca de conversa/usuário cancela pedidos (AbortController + chave);
  "anteriores" por `before`; novas por `after` em laço (até 5×100) com chamadas concorrentes coalescidas;
  UPDATE com id carregado atualiza só os campos permitidos (status etc.); DELETE com id remove, sem id reconcilia;
  reconciliação da janela carregada (até 20×100) ao reconectar e ao voltar à aba.
- `src/components/inbox/message-history-viewport.tsx`: "Carregar anteriores" (botão + topo), âncora manual pelo
  primeiro item visível (a âncora nativa do navegador não compensou corpos que chegam depois — medido); no fim
  continua no fim; lendo o histórico, mensagem nova mostra "N novas mensagens"; falha de página mostra
  "Tentar novamente" sem apagar o que já está na tela.
- Telas `/inbox/email`, `/inbox/whatsapp`, `/inbox/chat` passaram a usar isso. Ações (responder, atribuir,
  fechar, converter, envio, templates, marcar lida) e rascunhos por conversa sem mudança. Contagem de mensagens
  do e-mail vem de `message_count`. A Inbox unificada não mostra histórico (só "Abrir no canal").
- Chat: a consulta a cada 3 s foi removida (tempo real da sessão + reconciliação).
- Tempo real:
  - Assinaturas de mensagens antes eram globais na tabela (`whatsapp_messages`, `live_chat_messages`) e recarregavam
    tudo a cada evento de qualquer conversa; agora filtradas pela conversa aberta. E-mail: `email_threads id=eq`
    (mensagens de e-mail não estão na publicação; não foram adicionadas).
  - Filtro de caixas `account_id=in.(...)` dividido em blocos de 100.
  - **Achado:** o SDK responde `SUBSCRIBED` mesmo quando o servidor recusa o `postgres_changes`; a recusa só chega
    como mensagem `system` com `status:error`. `useRealtimeInvalidate` e o histórico agora tratam isso e
    `CHANNEL_ERROR/TIMED_OUT`: nova tentativa com espera crescente (5 s → 60 s) e reconciliação limitada
    (lista: 60 s; histórico: 30 s, com aviso na tela) enquanto não volta.

## Validado
- Preview, somente leitura, conta do solicitante (`bun` + SDK real):
  - Servidor aceitou: `email_threads account_id=in.(caixa própria)`, `whatsapp_messages conversation_id=eq`,
    `live_chat_messages session_id=eq`, `email_threads id=eq`. Recusou: filtro `in` inválido e
    `email_messages` (fora da publicação) — ambos com `SUBSCRIBED` no callback.
  - Cursor real no PostgREST: maior conversa WhatsApp (43) em páginas de 10 → 5 páginas, 43 distintos = total.
  - Navegador: maior thread de e-mail (28): primeira página e "Carregar anteriores" até o fim; o cartão em leitura
    ficou a 76 px do topo antes e depois, inclusive com corpos chegando depois (altura 24.800 → 31.951 px).
    Chat: histórico abriu e a assinatura `history:…:chat:…` respondeu "Subscribed to PostgreSQL". Sem erros no console.
- Banco PostgreSQL 16 descartável (`tests/sql/message-history-cursor-isolated.sql`): 1.200 mensagens com empates
  e microssegundos, páginas de 37/50/100, nova mensagem chegando durante a ida: sem perda, sem repetição,
  ordem estável — TODOS OK.
- `message-history.test.ts` (11): 501 e 1.203 mensagens até o início; primeira página = mais recentes (>500);
  nova mensagem durante "anteriores" e evento duplicado; status por UPDATE sem mudar ordem; DELETE; resposta de
  outra conversa descartada; falha de página preserva histórico; reconciliação remove excluídas; âncora.
  `channel-page.test.ts`: blocos de 100 caixas.

## Métricas (mesma conta, PostgREST direto, mesma conversa, 3 repetições)
| Conversa | Antes | Depois (1ª página) |
| --- | --- | --- |
| E-mail, 28 mensagens | 28 linhas, 421.025 B (todos os corpos) | 20 linhas, 17.570 B + corpos só dos cartões perto da tela |
| WhatsApp, 43 | 43 linhas, 20.418 B | 43 linhas, 22.869 B (+ id da conversa, mesmo volume) |
| Chat, 4 | 700 B | 908 B |
Navegador (dev): abrir a thread de e-mail fez 8–11 pedidos, 108–126 KB no total. Tempos de PostgREST variaram
entre rodadas (e-mail antes 482–732 ms; depois 158–168 ms) — ruído de rede, sem conclusão firme. As conversas
reais são pequenas: escala só foi testada nos dados fictícios isolados.

## Gates
tsgo exit 0; ESLint dos alterados 0 erros (6 avisos de tamanho/acesso direto, já existentes no padrão); vitest
exit 0 (102 arquivos / 699 testes); build exit 0 em 156 s (amostra única, sem ganho atribuído), entrada 1.047,28 KB.
Timeout de 240 s da verificação automática: sem comando/log novo, causa não determinada.

## Não validado / pendente
- Evento ponta a ponta (gravar → chegar na tela): não há Realtime isolado; no banco compartilhado exigiria gravar
  dados. Aceitação da assinatura está provada; entrega, não.
- WhatsApp no navegador: abrir a conversa marca como lida e avisa a Meta, então não foi aberta. Coberto por
  testes do redutor, cursor real via PostgREST e tipos.
- RLS não-admin real (requisito de publicação), sem sessões de terceiros.
- Chegada de mensagem nova com a pessoa lendo o histórico: lógica testada; não exercitada no navegador (precisaria
  de evento real).
- Fora do escopo, encontrado: a assinatura `branding:<usuário>` é recusada pelo servidor (o SDK diz SUBSCRIBED).
- Índice de e-mail `(thread_id, created_at, id)` não criado: maior thread real tem 28 mensagens; sem EXPLAIN
  que justifique.
- `listWhatsAppMessages`, `listChatMessages`, `getEmailThread` antigos mantidos (rollback; sem uso nas telas).

## Rollback
Reverter as três telas, `use-message-history`, o visualizador e as mudanças em `use-realtime-invalidate`/
`use-inbox-channel-page`; as funções antigas continuam existindo. Não há migração neste ciclo.
