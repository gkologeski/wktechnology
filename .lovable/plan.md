# Rolagem e histórico nas notificações (sino)

Porte: P — estimativa 30 a 45 minutos.

## O que muda para você
- A lista do sino passa a rolar de verdade dentro da janela (hoje ela é cortada e não rola).
- Ao chegar ao fim, carregam automaticamente as notificações mais antigas, 30 por vez, até acabar o histórico (hoje só aparecem as 50 últimas).
- Ao final aparece "Fim do histórico"; enquanto carrega, um indicador discreto.
- O número de não lidas passa a contar todas, não só as 50 mais recentes.

## Como
1. `src/lib/notifications.functions.ts`: `listMyNotifications` aceita cursor opcional (`created_at` + `id` da última notificação vista) e devolve 30 itens + `nextCursor`. Contagem de não lidas feita à parte no banco (`count` com `read_at is null`), sempre só do próprio usuário (mesma regra atual).
2. `src/components/notifications-bell.tsx`: trocar por carregamento em páginas (`useInfiniteQuery`), altura fixa da área de rolagem (substitui o `max-h` que impede a rolagem) e carregar a próxima página ao chegar perto do fim. "Marcar todas" e marcar como lida continuam iguais.
3. Teste do cursor (página seguinte não repete itens) e conferência no navegador rolando até o histórico antigo.

## Fora do escopo
Sem mudança no banco, permissões ou na tela de preferências.
