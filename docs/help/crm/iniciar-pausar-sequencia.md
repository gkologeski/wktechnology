---
module_key: crm
slug: iniciar-pausar-sequencia
title: Iniciar e pausar execuções de sequência
summary: Confirme o início de uma inscrição e acompanhe as execuções da versão.
article_type: howto
route_pattern: /prospecting/sequences
min_permission: system.automation.sequences.view.workspace
audience: internal
sort_order: 408
version: 2
is_published: true
---
# Iniciar e pausar execuções de sequência
**Para que serve:** Iniciar os contatos reservados e acompanhar a execução.
**Quem pode fazer:** Quem vê sequências (`system.automation.sequences.view`) e pode gerenciá-las (`system.automation.sequences.manage`) para o responsável da execução. Retomar também exige poder atribuir (`system.automation.sequences.assign`). O servidor confere essas regras.
**Onde fica:** Menu > TechSales > Sequências de prospecção (`/prospecting/sequences`).
**Antes de começar:** Crie uma versão e reserve o público.

## Passo a passo
1. Localize "Execução e acompanhamento".
2. Confira a inscrição e os contatos reservados.
3. Clique em "Iniciar inscrição selecionada".
4. Leia o aviso e clique em "Confirmar início".
5. Clique em "Atualizar" para ver as execuções.
6. Para pausar, clique em "Pausar" (execuções ativas ou aguardando tarefa). Para retomar, clique em "Retomar" (execuções pausadas). Em execuções bloqueadas use "Revalidar e tentar novamente"; em incertas, "Conferir recibo existente".
7. Para cancelar, clique em "Cancelar inscrição e liberar reservas seguras".
8. Clique em "Confirmar cancelamento da inscrição".
<!-- screenshot: confirmação de início e acompanhamento das execuções -->

## Resultado esperado
Os contatos seguem as etapas conforme horários e limites da versão.

## Regras e limites
O envio só é confirmado após retorno do provedor. Chamadas humanas aguardam a atividade; automáticas aguardam o resultado da telefonia. Cancelar libera reservas sem envio pendente; envios aceitos ficam no histórico.

## Erros comuns
"Não foi possível carregar as execuções. Atualize para tentar novamente.": clique em "Atualizar".

## Relacionados
- [Reservar o público de uma sequência](/ajuda/crm/reservar-publico-de-sequencia)
- [Configurar canais e planejamento de uma sequência](/ajuda/crm/configurar-canais-planejamento-de-sequencia)
