---
module_key: people
slug: lancar-horas-na-ficha
title: Lançar e corrigir horas na ficha
summary: Registrar apontamentos por projeto, data e tarefa no timesheet da pessoa.
article_type: howto
route_pattern: /people/$id
min_permission: techpeople.timesheet.view.own
audience: internal
sort_order: 121
version: 1
is_published: true
---
# Lançar e corrigir horas na ficha

**Para que serve:** Registrar apontamentos por projeto, data e tarefa no timesheet da pessoa.
**Quem pode fazer:** É necessário acesso à pessoa e permissão de visualização do recurso da aba. A gravação também depende das regras de acesso do apontamento no servidor e no banco.
**Onde fica:** TechPeople > Pessoas > abrir a ficha > Timesheet (`/people/$id`).
**Antes de começar:** Tenha um projeto disponível e confira a pessoa e o período.

## Passo a passo
1. Clique em "Lançar horas". Para corrigir, abra a edição pelo lápis do apontamento.
2. Selecione o projeto e, se aplicável, a tarefa. Informe a data e a quantidade de horas.
3. Confira se o apontamento é faturável e preencha a tarifa por hora apenas quando necessário; uma tarifa vazia não define uma nova tarifa manual.
4. Registre a descrição e salve. Confira a mensagem e a linha na lista.
5. Se a linha não aparecer, ajuste o período e os filtros de projeto, status e tipo. Para excluir, use a lixeira e confirme quando autorizado.

## Resultado esperado
A tela informa "Apontamento criado" ou "Apontamento atualizado" e recarrega o timesheet.

## Regras e limites
- A interface exige horas maiores que zero; o servidor aceita de 0 a 24. Para este fluxo da tela, use mais de zero e no máximo 24 por lançamento.
- Projeto é obrigatório. Tarefa é opcional. O lançamento não equivale a envio nem aprovação de um período.
- As permissões e restrições do banco continuam valendo mesmo quando a tela mostra os botões de edição ou exclusão.

## Erros comuns
- "Selecione um projeto": escolha o projeto antes de salvar.
- "Horas devem ser maior que zero": corrija a quantidade.
- "Pessoa não encontrada": confira a ficha e seu acesso.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
- [Permissões do TechPeople](/ajuda/people/permissoes)
