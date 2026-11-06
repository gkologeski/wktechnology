---
module_key: crm
slug: organizar-tarefas
title: Organizar tarefas
summary: Localizar tarefas, salvar visualizações e executar ações individuais ou em massa.
article_type: howto
route_pattern: /tasks
min_permission:
audience: internal
sort_order: 205
version: 2
is_published: true
---
# Organizar tarefas
**Para que serve:** Organizar o trabalho por status, prioridade e vencimento.
**Quem pode fazer:** Membros ativos com TechSales licenciado e permissões de `techsales.tasks` adequadas à ação e aos registros.
**Onde fica:** Menu > TechSales > Tarefas (`/tasks`).
**Antes de começar:** Confira quais tarefas estão no seu escopo de acesso.

## Passo a passo
1. Abra "Tarefas".
2. Use a busca "Buscar assunto, descrição…".
3. Ajuste os grupos "Status", "Priority" e "Due date".
4. Para cadastrar uma atividade, clique em "Criar tarefa" e preencha a janela.
5. Para reutilizar uma combinação de filtros, abra o menu de visões e clique em "Salvar como nova visão…". Em "Salvar visão", preencha "Nome", marque "Compartilhar com o workspace" se quiser e clique em "Salvar". A visão guarda filtros, busca e ordenação.
6. Selecione tarefas para executar as ações em massa disponíveis.
7. Use o botão de exportação e escolha "Exportar CSV" ou "Exportar Excel (XLSX)". São exportadas as tarefas exibidas no resultado atual. Sem registros, aparece "Nenhum registro para exportar".
8. Clique em "Queues" para organizar uma fila.
<!-- screenshot: Tarefas com busca, filtros, visualizações e seleção de registros -->

## Resultado esperado
A lista apresenta as tarefas filtradas. Uma visualização salva mostra "Visualização salva". Concluir ou reabrir uma tarefa mostra "Concluída" ou "Reaberta".

## Regras e limites
- Ações em massa podem ter resultado parcial por causa das permissões. Confira o resultado antes de repetir.
- Excluir uma tarefa e concluir uma tarefa são ações diferentes.
- As permissões valem na tela, no servidor e no banco.

## Erros comuns
- "Nenhum registro para exportar": ajuste os filtros para obter resultados.
- "Falha ao selecionar todos": tente novamente e confira seu acesso.
- "Erro ao salvar": tente salvar a visualização novamente.
- "Verifique suas permissões.": revise os registros que não foram alterados.

## Relacionados
- [Concluir e atribuir uma tarefa](/ajuda/crm/concluir-atribuir-tarefa)
- [Criar filas de tarefas](/ajuda/crm/criar-filas-tarefas)
