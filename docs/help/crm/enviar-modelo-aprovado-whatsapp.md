---
module_key: crm
slug: enviar-modelo-aprovado-whatsapp
title: Enviar um modelo aprovado no WhatsApp
summary: Selecionar um template aprovado pela Meta e preencher as variáveis.
article_type: howto
route_pattern: /inbox/whatsapp
min_permission:
audience: internal
sort_order: 305
version: 1
is_published: true
---
# Enviar um modelo aprovado no WhatsApp
**Para que serve:** Iniciar ou continuar uma conversa fora da janela de 24 horas.
**Quem pode fazer:** Quem pode criar mensagens em `techsales.inbox.whatsapp`.
**Onde fica:** Menu > TechSales > Inbox unificada > WhatsApp (`/inbox/whatsapp`).
**Antes de começar:** Tenha um modelo `APPROVED` na conta usada.

## Passo a passo
1. Abra a conversa.
2. Localize "Modelo aprovado pela Meta".
3. Em "Escolha um modelo aprovado", selecione o modelo.
4. Preencha as variáveis do corpo e do cabeçalho.
5. Se o modelo pedir mídia, anexe.
6. Clique em "Enviar modelo".
<!-- screenshot: modelo selecionado com variáveis -->

## Resultado esperado
O servidor confirma a aprovação e envia.

## Regras e limites
- O modelo é conferido na conta e no canal da conversa.
- Pendente ou reprovado não pode ser enviado.
- Se a consulta à Meta falhar, o envio é bloqueado até funcionar.
- Enviar modelo não abre janela de texto livre; só a resposta do cliente abre.

## Erros comuns
- "Este modelo não está aprovado pela Meta. Escolha outro modelo aprovado.".
- "Não foi possível confirmar o modelo na conta do WhatsApp agora. Tente novamente em instantes.".
- "Este modelo tem cabeçalho de mídia: anexe o arquivo antes de enviar.".
- "Preencha a variável do cabeçalho do modelo.".
- "Preencha a variável {{1}} do modelo.": o número indica a variável vazia.

## Relacionados
- [Atender conversas de WhatsApp](/ajuda/crm/atender-conversas-whatsapp)
