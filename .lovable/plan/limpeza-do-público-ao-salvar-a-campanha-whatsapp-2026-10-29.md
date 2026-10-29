# Limpeza do público ao salvar a campanha WhatsApp

Porte P/M — estimativa 40–60 min (inclui teste e aplicação na ICP 008).

## Problema
Ao salvar o público, a regra de "contato recente" compara o telefone exatamente como está. No disparo, a conferência aceita as variações do mesmo número (com e sem o 9 extra). Por isso contatos que passam ao salvar são barrados um a um durante o envio, a cada rodada de 2 min, e a fila anda devagar.

## O que vou fazer
1. Criar uma função no banco que, de uma só vez, marca como "Ignorado — Envio recente" todos os pendentes da campanha que receberam WhatsApp de outra campanha dentro do período configurado, usando as mesmas variações de número do disparo. Respeita a liberação manual (`override_recent`) e o período por campanha (padrão 7 dias).
2. Chamar essa função logo após salvar/atualizar a lista de destinatários e ao iniciar a campanha. Se falhar, o salvamento não é perdido: a conferência no disparo continua valendo como segunda proteção.
3. Corrigir a pré-visualização do público para usar as mesmas variações de número, de modo que a contagem mostrada antes de salvar bata com o que será enviado.
4. Rodar a função uma vez na ICP 008 (pausa não necessária) para liberar os elegíveis já na próxima rodada.

## O que não muda
- Nada é reenviado; enviados e falhas ficam intactos.
- Regras de cliente/negociação aberta e opt-out seguem como estão.
- A conferência no momento do envio continua existindo.

## Detalhes técnicos
- Migration: `public.wa_campaign_prune_recent(p_campaign_id uuid) returns int`, `security invoker`, valida membership ativo do workspace da campanha + permissão `techsales.marketing.campaigns` manage; UPDATE com `EXISTS` sobre `whatsapp_campaign_recipients` (status sent, outra campanha, `sent_at >= now() - recent_contact_days`), casando por variantes BR (com/sem 9) via função SQL espelhando `brPhoneVariants`. Índice parcial `(workspace_id, phone, sent_at) where status='sent'` se o EXPLAIN mostrar varredura.
- `whatsapp-campaigns.functions.ts`: chamar o RPC após insert/replace de recipients e no start; `applyRecentGuard`/`loadRecentWhatsAppSends` passam a indexar por variantes.
- Contrato em `permission-contracts.json` + teste dos 5 cenários; teste unitário de variantes; `permissions:check`.
- Verificação: contagem antes/depois na ICP 008 no banco e tela da campanha no Playwright.
