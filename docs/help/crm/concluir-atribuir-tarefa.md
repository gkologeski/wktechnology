---
module_key: crm
slug: concluir-atribuir-tarefa
title: Concluir e atribuir uma tarefa
summary: Consultar uma tarefa, atualizar seu responsável e marcar a conclusão.
article_type: howto
route_pattern: /tasks/$id
min_permission:
audience: internal
sort_order: 206
version: 2
is_published: true
---
# Concluir e atribuir uma tarefa
**Para que serve:** Tratar uma tarefa individual e manter o responsável atualizado.
**Quem pode fazer:** Membros ativos com acesso à tarefa e permissões aplicáveis de `techsales.tasks`. Excluir exige autorização específica de exclusão.
**Onde fica:** Menu > TechSales > Tarefas > Tarefa (`/tasks/$id`).
**Antes de começar:** Localize a tarefa na lista e abra seu detalhe.

## Passo a passo
1. Confira as propriedades e a área "Descrição".
2. No seletor "Selecionar responsável", escolha quem ficará responsável.
3. Clique em "Marcar concluída" na tarefa. Para várias tarefas selecionadas, use "Concluir". Para desfazer, use "Reabrir".
4. Para remover o registro, clique em "Excluir tarefa".
5. Confira o aviso "Excluir tarefa?" e confirme somente se deseja remover o registro.
<!-- screenshot: detalhe da tarefa com Descrição, responsável e ação de exclusão -->

## Resultado esperado
A troca de responsável mostra "Responsável atualizado". A conclusão mostra "Concluída". A exclusão mostra "Excluída".

## Regras e limites
- A exclusão não pode ser desfeita.
- Atribuição, conclusão e exclusão dependem das permissões correspondentes.
- "Sem descrição." indica que não há descrição, não uma falha.

## Erros comuns
- Se a tarefa não carregar, confira o endereço e seu acesso ao registro.
- Se a exclusão for recusada, não repita: peça a uma pessoa autorizada.
- Falhas ao atualizar o responsável mostram a mensagem devolvida pelo servidor.

## Relacionados
- [Organizar tarefas](/ajuda/crm/organizar-tarefas)
- [Permissões](/ajuda/crm/permissoes)
