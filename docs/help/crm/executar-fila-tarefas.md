---
module_key: crm
slug: executar-fila-tarefas
title: Executar uma fila de tarefas
summary: Tratar os itens da fila, registrar anotações e concluir ou pular cada atendimento.
article_type: howto
route_pattern: /tasks/queues/$queueId/play
min_permission:
audience: internal
sort_order: 208
version: 2
is_published: true
---
# Executar uma fila de tarefas
**Para que serve:** Executar uma fila em sequência, sem abrir cada registro separadamente.
**Quem pode fazer:** Membros ativos com acesso à fila e autorização para atualizar seus itens. O banco aplica a permissão `techsales.task_queues`.
**Onde fica:** Menu > TechSales > Tarefas > Filas > Executar fila (`/tasks/queues/$queueId/play`).
**Antes de começar:** Crie uma fila e adicione itens.

## Passo a passo
1. Abra a execução da fila.
2. Confira o nome do registro e os dados de contato.
3. Clique em "Email" para preparar uma mensagem, quando houver e-mail.
4. Clique em "Ligar" para abrir o discador do dispositivo, quando houver telefone.
5. Registre o atendimento em "Anotações".
6. Clique em "Concluir (C)" para concluir o item ou em "Pular (S)" para pulá-lo.
7. Continue até aparecer "Fila concluída 🎉".
8. Clique em "Voltar para filas".
<!-- screenshot: item da fila com Email, Ligar, Anotações, Pular (S) e Concluir (C) -->

## Resultado esperado
A ação salva as anotações do item e avança para o próximo pendente. Ao terminar, aparece "Todos os itens foram tratados.".

## Regras e limites
- Itens concluídos ou pulados saem da lista de pendentes. "Pular (S)" não conclui o atendimento.
- Atalhos: C e S. Prefira os botões enquanto edita anotações.
- As anotações são gravadas ao concluir ou pular; não há salvamento automático ao sair.
- "Ligar" depende de um aplicativo de chamadas no dispositivo.

## Erros comuns
- Se uma ação falhar, leia a mensagem e tente novamente antes de sair.
- Se "Email" ou "Ligar" não aparecer, o registro não tem o dado correspondente.

## Relacionados
- [Criar filas de tarefas](/ajuda/crm/criar-filas-tarefas)
- [Organizar tarefas](/ajuda/crm/organizar-tarefas)
