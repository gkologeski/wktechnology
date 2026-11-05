---
module_key: crm
slug: acompanhar-ticket
title: Acompanhar um ticket
summary: Consultar propriedades, mudar a etapa e aplicar macros.
article_type: howto
route_pattern: /tickets/$id
min_permission:
audience: internal
sort_order: 511
version: 2
is_published: true
---
# Acompanhar um ticket
**Para que serve:** Consultar uma solicitação e acompanhar seu andamento.
**Quem pode fazer:** Membros ativos com acesso ao ticket. Alterar e excluir seguem `techsales.tickets`.
**Onde fica:** Menu > TechSales > Tickets > ticket (`/tickets/$id`).
**Antes de começar:** Localize o ticket na lista.

## Passo a passo
1. Abra o ticket.
2. Confira assunto, criação e vencimento no cabeçalho.
3. Consulte propriedades e histórico.
4. Selecione a etapa no indicador de andamento.
5. Clique em "Aplicar macro" e escolha uma macro na lista "Macros".
6. Para excluir, use "Excluir ticket" e confirme.
<!-- screenshot: cabeçalho, etapas e propriedades do ticket -->

## Resultado esperado
O detalhe mostra o estado atual. Exclusão mostra "Excluído".

## Regras e limites
- O indicador de etapas só aparece se o pipeline tiver etapas.
- "Excluir ticket" fica desabilitado sem permissão.

## Erros comuns
- Falha de atualização mostra a mensagem do servidor.
- "Excluir ticket" desabilitado: peça revisão do seu acesso.

## Relacionados
- [Consultar e organizar tickets](/ajuda/crm/consultar-organizar-tickets)
- [Gerenciar macros](/ajuda/crm/gerenciar-macros)
