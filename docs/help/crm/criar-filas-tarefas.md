---
module_key: crm
slug: criar-filas-tarefas
title: Criar filas de tarefas
summary: Agrupar contatos, leads ou negócios para executar o trabalho em sequência.
article_type: howto
route_pattern: /tasks/queues
min_permission:
audience: internal
sort_order: 207
version: 2
is_published: true
---
# Criar filas de tarefas
**Para que serve:** Agrupar registros para tratar um item de cada vez.
**Quem pode fazer:** Membros ativos com TechSales licenciado e autorização para consultar e alterar as filas. O banco aplica a permissão `techsales.task_queues`.
**Onde fica:** Menu > TechSales > Tarefas > Filas (`/tasks/queues`).
**Antes de começar:** Defina os contatos, leads ou negócios que deseja organizar.

## Passo a passo
1. Na área "Nova fila", preencha "Nome".
2. Se necessário, preencha "Descrição (opcional)".
3. Clique em "Criar fila". Aparece "Fila criada".
4. Clique em "Adicionar". Na janela "Adicionar contatos à fila", selecione os registros e clique em "Adicionar (N)".
5. Use a ação de execução da fila para começar o atendimento sequencial.
6. Para remover uma fila, use sua ação de exclusão.
<!-- screenshot: Nova fila com Nome, Descrição (opcional) e uma fila cadastrada -->

## Resultado esperado
O cadastro mostra "Fila criada". A fila fica disponível para receber itens e ser executada.

## Regras e limites
- "Nome" é obrigatório, até 120 caracteres.
- A descrição é opcional, até 500 caracteres.
- A fila organiza contatos, leads ou negócios; não é a lista geral de tarefas.

## Erros comuns
- Se a criação falhar, confira o nome e os limites de tamanho.
- Falhas de criação ou exclusão mostram a mensagem devolvida pelo servidor.

## Relacionados
- [Executar uma fila de tarefas](/ajuda/crm/executar-fila-tarefas)
- [Organizar tarefas](/ajuda/crm/organizar-tarefas)
