## Validação visual: chamadas e reuniões na timeline

Objetivo: confirmar, via Playwright headless contra o preview local autenticado, que em `/tickets/:id`, `/leads/:id` e no drawer de detalhe de negócios não existem mais blocos "Histórico de chamadas" e "Reuniões" acima da timeline, e que ambos os tipos aparecem como eventos dentro da `ActivityTimeline`.

### Passos
1. Subir Playwright headless (Chromium pré-instalado), restaurar sessão Supabase via `LOVABLE_BROWSER_SUPABASE_*` em `localhost:8080`.
2. Abrir o ticket atual (`/tickets/0a1da4e3-...`) e tirar screenshot da área acima da timeline para confirmar ausência dos painéis `CallHistoryPanel` e `MeetingsPanel`.
3. Abrir um lead recente (`/leads`) e repetir a verificação.
4. Abrir um negócio (`/deals`), abrir o drawer e verificar a aba "Atividades".
5. Em cada tela, conferir na timeline a presença de pelo menos um item com ícone de telefone (`call`) e/ou calendário (`meeting`), quando existirem registros.
6. Reportar com prints e estado observado (URL final, contagem por tipo, eventuais erros de console).

### Sem alterações de código
Esta entrega é apenas verificação. Nenhum arquivo de produção será alterado; scripts ficam em `/tmp/browser/`. Se a verificação encontrar regressão, retorno com plano de correção antes de implementar.
