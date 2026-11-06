---
module_key: people
slug: usar-analytics
title: Usar o Analytics e sincronizar a folha
summary: Ver headcount, turnover, custos e margem; enviar a folha ao TechFinance.
article_type: howto
route_pattern: /people/analytics
min_permission: techpeople.allocations.view.own
audience: internal
sort_order: 80
version: 1
is_published: true
---
# Usar o Analytics e sincronizar a folha
**Para que serve:** Ver headcount, movimentação, custos e margem das alocações.
**Quem pode fazer:** Quem tem `techpeople.allocations.view` (ou é gestor). Custos exigem `techpeople.people_sensitive.view`; margem exige `techpeople.allocations_financial.view`. "Sincronizar folha" exige, no workspace: `techpeople.people.view`, `techpeople.people_sensitive.view`, `techpeople.benefits.view` e `techfinance.recurrences.view`, `.create` e `.update`.
**Onde fica:** Menu > TechPeople > Benefícios & custos > Analytics (`/people/analytics`).
**Antes de começar:** Custos mensais e benefícios preenchidos nas fichas.

## Passo a passo
1. Confira "Headcount ativo", "Turnover 12m", "Custo mensal (base)", "Custo total mensal", "Receita projetada", "Custo projetado" e "Margem".
2. Veja "Admissões (12 meses)", "Desligamentos (12 meses)", "Por status" e "Por tipo de contrato".
3. Para enviar a folha ao financeiro, clique em "Sincronizar folha". Abre a prévia; nada é gravado.
4. Confira "Criadas", "Atualizadas", "Desativadas" e "Total mensal a materializar:".
5. Clique em "Aplicar".
<!-- screenshot: analytics -->

## Resultado esperado
"Folha sincronizada". Cada pessoa ativa ganha uma conta a pagar mensal no TechFinance.

## Regras e limites
- Turnover = desligamentos dos últimos 12 meses ÷ headcount atual.
- Receita e custo projetados usam 160 horas × percentual de alocação.
- Se você não puder ver o custo de alguma pessoa, o total aparece como "—".
- A sincronização usa custo mensal + benefícios vigentes. Pode rodar várias vezes sem duplicar. Vencimento padrão: dia 5.

## Erros comuns
- "Sem permissão para consultar toda a base de custos. Nenhuma recorrência foi alterada.": peça acesso a dados privados de todas as pessoas.

## Relacionados
- [Consultar margem por contrato](/ajuda/people/consultar-margem-contrato)
