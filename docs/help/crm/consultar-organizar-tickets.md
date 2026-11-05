---
module_key: crm
slug: consultar-organizar-tickets
title: Consultar e organizar tickets
summary: Buscar tickets, escolher uma visualização e cadastrar atendimentos.
article_type: howto
route_pattern: /tickets
min_permission:
audience: internal
sort_order: 510
version: 2
is_published: true
---
# Consultar e organizar tickets
**Para que serve:** Localizar solicitações e organizar o atendimento.
**Quem pode fazer:** Membros ativos com TechSales licenciado. Excluir exige `techsales.tickets.delete.own`, `.delete.workspace` ou `.manage.workspace`.
**Onde fica:** Menu > TechSales > Atender > Tickets (`/tickets`).
**Antes de começar:** Confira pipelines e responsáveis.

## Passo a passo
1. Use "Buscar tickets…".
2. Escolha o pipeline ou "Todos os pipelines".
3. Filtre a prioridade ou "Todas prioridades".
4. Escolha a visualização: "Tabela", "Quadro" ou "Split".
5. Clique em "Novo ticket", preencha e clique em "Criar".
6. Preencha "Assunto *" e "Descrição".
7. Ajuste "Status", "Prioridade", "Responsável", "Fonte" e "Vencimento".
8. Vincule "Contato", "Empresa" e "Negócio".
9. Salve.
10. Para ações em massa, selecione os tickets e escolha a ação.
<!-- screenshot: filtros e formulário de ticket -->

## Resultado esperado
"Ticket criado." ou "Ticket atualizado.".

## Regras e limites
- "Assunto *" obrigatório.
- Exclusão em massa pode ser parcial conforme o acesso.
- Exclusão individual pede "Excluir este ticket?".

## Erros comuns
- "Informe um assunto.": preencha o assunto.

## Relacionados
- [Acompanhar um ticket](/ajuda/crm/acompanhar-ticket)
- [Habilitar o portal do cliente](/ajuda/crm/habilitar-portal-do-cliente)
