# ICP 007 — excluir contatos com envio nos últimos 30 dias

Porte P — estimativa ~10–15 min.

## Situação atual (consultada agora)
- Campanha "ICP 007": pausada, regra de contato recente = 7 dias, 114 destinatários.
- 60 já enviados (não serão tocados — mensagem enviada não volta).
- 54 pendentes; destes, **33** receberam outra mensagem nossa de WhatsApp nos últimos 30 dias.

## O que será feito
1. Alterar a regra "Contato recente" da ICP 007 de 7 para **30 dias** (vale também se o público for recalculado).
2. Marcar os 33 pendentes como **ignorados por contato recente** (mesmo status usado pelo filtro automático), sem apagar — ficam registrados e podem ser liberados manualmente.
3. Respeitar liberações manuais já feitas ("override_recent"), se houver.
4. Não retomar a campanha: ela continua pausada; você decide quando disparar os 21 restantes.

## Validação
- Contagem final: 60 enviados, 33 ignorados, 21 pendentes.
- Conferir na tela da campanha que os números batem.
- Nenhuma mensagem enviada, nenhum cadastro de cliente alterado, nada publicado.

## Técnico
- `UPDATE whatsapp_campaigns SET recent_contact_days=30` no id da ICP 007.
- `UPDATE whatsapp_campaign_recipients SET status='skipped_recent', error='Contato nos últimos 30 dias'` (confirmar o valor de status usado pelo motor antes) onde status='pending', override_recent não verdadeiro, e existe mensagem outbound em `whatsapp_messages` nos últimos 30 dias para o mesmo telefone (10 últimos dígitos) no workspace, fora desta campanha.
