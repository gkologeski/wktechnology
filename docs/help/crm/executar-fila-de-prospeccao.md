---
module_key: crm
slug: executar-fila-de-prospeccao
title: Executar uma fila de prospecção
summary: Escolha um questionário e percorra os leads ou contatos de uma fila.
article_type: howto
route_pattern: /prospecting/queues/$queueId/play
min_permission: techsales.prospecting_search.view.workspace
audience: internal
sort_order: 403
version: 1
is_published: true
---
# Executar uma fila de prospecção
**Para que serve:** Trabalhar os registros de uma fila com um questionário comercial.
**Quem pode fazer:** Usuários com `techsales.prospecting_queue.view.workspace`. Gravar a qualificação depende da permissão da operação.
**Onde fica:** Menu > TechSales > Prospecção > Meu trabalho > Filas (`/prospecting/queues/$queueId/play`).
**Antes de começar:** Tenha uma fila com itens e um questionário ativo.

## Passo a passo
1. Abra a execução da fila.
2. Em "Escolha um questionário", use "Selecionar questionário".
3. Clique em "Começar".
4. Revise os dados, o histórico e o painel de qualificação.
5. Avance pelos itens. Fora dos campos, S, N ou seta para a direita avançam.
6. Ao terminar, clique em "Voltar para filas".
<!-- screenshot: escolha de questionário e item da fila -->

## Resultado esperado
Ao fim, a tela mostra "Fila concluída 🎉".

## Regras e limites
Carrega até 200 itens. Avançar só muda o item exibido; não salva respostas nem muda status.

## Erros comuns
- "Sem acesso à Fila de prospecção": peça a permissão ao administrador.
- "Nenhum questionário ativo.": crie ou ative um questionário.
- "Esta fila não possui itens.": revise a fila.

## Relacionados
- [Navegar na prospecção](/ajuda/crm/navegar-na-prospeccao)
- [Permissões](/ajuda/crm/permissoes)
