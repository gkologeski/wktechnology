---
module_key: finance
slug: conciliar-transacoes
title: Conciliar transações bancárias
summary: Conciliar transações bancárias no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/banking/reconciliation
min_permission: techfinance.banking.view.workspace
audience: internal
sort_order: 220
version: 2
is_published: true
---
# Conciliar transações bancárias

**Para que serve:** Conciliar transações bancárias, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.banking`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Conciliar transações bancárias (`/finance/banking/reconciliation`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Confira pendências e ajuste a janela de busca de candidatos entre 0 e 30 dias.
2. Revise os candidatos e aceite o match correto, ou ignore a transação justificadamente.
3. Em lote, selecione transações e use vincular, criar ou ignorar conforme sua autorização.
4. Confira vinculadas, sem candidato, criadas e ignoradas retornadas.
5. No histórico, filtre Conciliados ou Ignorados e reative quando necessário.

## Resultado esperado
Transações conciliadas ou classificadas conforme a decisão autorizada.

## Regras e limites
- Leitura usa banking.view.workspace; conciliar exige `techfinance.banking.update.workspace`.
- Criação de lançamentos exige também permissão de criação de entries.
- Candidato é sugestão; revise valor e contexto antes de aceitar.
- Reativar não é estorno de transferência externa.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

![Tela: Conciliar transações bancárias](/help-media/finance/conciliar-transacoes.webp)
<!-- evidência: src/routes/_authenticated/finance.banking.reconciliation.tsx -->
