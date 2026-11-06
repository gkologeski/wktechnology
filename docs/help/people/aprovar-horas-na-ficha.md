---
module_key: people
slug: aprovar-horas-na-ficha
title: Aprovar e remover aprovação de horas na ficha
summary: Decidir sobre apontamentos enviados e reabrir aprovações pelo timesheet.
article_type: howto
route_pattern: /people/$id
min_permission: techpeople.timesheet.view.own
audience: internal
sort_order: 122
version: 1
is_published: true
---
# Aprovar e remover aprovação de horas na ficha

**Para que serve:** Decidir sobre apontamentos enviados e reabrir aprovações pelo timesheet.
**Quem pode fazer:** É necessário acesso à pessoa e permissão de visualização do recurso da aba. Aprovar depende de aprovador explícito no fluxo de TechProjects e das validações no banco; não há autoaprovação. A presença do botão não concede autorização.
**Onde fica:** TechPeople > Pessoas > abrir a ficha > Timesheet (`/people/$id`).
**Antes de começar:** O profissional precisa ter enviado o período no fluxo de timesheet; lançar horas na ficha não faz esse envio.

## Passo a passo
1. Ajuste o período e os filtros para localizar os apontamentos. Confira projeto, horas e situação antes de selecionar.
2. Marque as caixas das linhas desejadas ou a seleção de todas as linhas filtradas. Revise a seleção antes de mudar filtros.
3. Clique em "Aprovar" na barra de seleção. Aguarde a confirmação com a quantidade efetivamente aprovada.
4. Para reabrir, selecione os apontamentos aprovados e clique em "Remover aprovação". Aguarde a quantidade de aprovações removidas.
5. Confira novamente a situação das linhas e os totais; se o servidor recusar, corrija o envio ou a autorização em vez de repetir sem revisão.

## Resultado esperado
A tela apresenta a quantidade aprovada ou reaberta e atualiza as consultas.

## Regras e limites
- Aprovar aceita de 1 a 500 IDs; remover aprovação, de 1 a 200. Divida seleções maiores.
- O servidor busca itens de submissão com decisão pendente e envia a revisão para a decisão no banco. Não basta a linha não ter data de aprovação.
- Reabrir usa, neste painel, o motivo padrão "Aprovação reaberta pelo TechPeople"; não há campo de motivo nessa ação da ficha.
- A seleção é independente dos filtros: mudar filtros não limpa automaticamente os IDs já selecionados. Limpe a seleção e selecione novamente quando necessário.

## Erros comuns
- "Nenhum apontamento enviado para decisão: o profissional precisa enviar o período antes.": peça o envio antes de aprovar.
- Recusa do servidor: confira aprovador, revisão enviada e regras do período; visualizar a aba não basta.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Permissões do TechPeople](/ajuda/people/permissoes)
