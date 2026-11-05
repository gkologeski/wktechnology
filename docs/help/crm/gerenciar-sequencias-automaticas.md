---
module_key: crm
slug: gerenciar-sequencias-automaticas
title: Gerenciar sequências automáticas
summary: Configure cadências automáticas de tarefas e e-mails e acompanhe inscrições.
article_type: howto
route_pattern: /settings/sequences
min_permission: system.automation.sequences.view.workspace
audience: internal
sort_order: 411
version: 1
is_published: true
---
# Gerenciar sequências automáticas
**Para que serve:** Administrar sequências de tarefas e e-mails.
**Quem pode fazer:** Gestor+ ou `system.automation.sequences.view.workspace`/`.manage.workspace`. Alterar exige gerenciamento.
**Onde fica:** Menu > TechSales > Otimizar > Sequências (`/settings/sequences`).
**Antes de começar:** Não confunda com "Sequências de prospecção" (`/prospecting/sequences`).

## Passo a passo
1. Na aba "Sequências", clique em "Nova sequência".
2. Configure no editor e salve.
3. Para alterar, use o ícone de lápis.
4. Use o interruptor para ativar ou desativar.
5. Para excluir, clique na lixeira e confirme "Excluir esta sequência?".
6. Abra "Inscrições" para ver os inscritos.
7. Pause, retome ou remova inscrições pelos controles da linha.
8. Clique em "Rodar agora" para processar.
<!-- screenshot: lista de sequências, interruptor e aba Inscrições -->

## Resultado esperado
"Sequência salva". "Rodar agora" mostra quantas inscrições foram processadas.

## Regras e limites
A lista de inscrições mostra até 50. Esta tela não usa versões imutáveis.

## Erros comuns
"Nenhuma sequência ainda. Crie uma para começar." indica lista vazia. "Erro" sem detalhe: confira dados e permissões.

## Relacionados
- [Criar o fluxo de uma sequência multicanal](/ajuda/crm/criar-fluxo-de-sequencia)
- [Permissões](/ajuda/crm/permissoes)
