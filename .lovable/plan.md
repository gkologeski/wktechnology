# Corrigir "Envios por dia" no Painel de Vendas

Porte: P — estimativa 30 a 45 minutos.

## O que muda para você
- O gráfico passa a mostrar todos os dias com envio de campanha, sem lacunas por limite de volume.
- Conta somente mensagens disparadas por campanhas (WhatsApp e e-mail) com status "enviado". Respostas dos clientes e mensagens dos agentes/Inbox não entram.

## Como
1. Em `src/lib/deals/campaign-funnel.server.ts`, buscar os destinatários de campanha (`whatsapp_campaign_recipients` e destinatários de e-mail) em páginas de 1.000 com `.range()` até esgotar, em vez de uma única consulta que o banco corta em 1.000.
2. Manter o filtro atual: só `status = 'sent'` e data por `sent_at` (data do disparo), já agrupada por dia no fuso de São Paulo.
3. Aplicar a mesma paginação às demais consultas da mesma função com `.limit(LIMIT)`, para os totais do funil não ficarem menores que o real.
4. Teste novo: 2.500 envios em dias diferentes resultam em todos os dias contados; respostas não entram.
5. Conferir no navegador o gráfico de 22/10 a 30/10 e comparar com contagem direta no banco.

## Fora do escopo
Sem mudança de permissões, banco ou visual do gráfico.
