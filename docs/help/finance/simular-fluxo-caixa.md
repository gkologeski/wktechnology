---
module_key: finance
slug: simular-fluxo-caixa
title: Simular fluxo de caixa
summary: Simular fluxo de caixa no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/cash-flow
min_permission: techfinance.reports.view.workspace
audience: internal
sort_order: 130
version: 2
is_published: true
---
# Simular fluxo de caixa

**Para que serve:** Simular fluxo de caixa, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.reports`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Simular fluxo de caixa (`/finance/cash-flow`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Selecione empresa ou grupo.
2. Confira vencidos e projeções de 0–30, 31–60 e 61–90 dias.
3. Abra Cenários e ajuste percentuais de recebimento e despesas mantidas.
4. Compare os cenários pessimista, realista e otimista.

## Resultado esperado
Projeção recalculada sem alterar títulos ou executar pagamentos.

## Regras e limites
- Recebimento padrão: 70%, 100% e 105%; despesas mantidas: 100% nos três cenários.
- Fatores validados no servidor entre 0 e 2.
- Consolidado indica quantidade de CNPJs e lançamentos intercompany eliminados.
- Alterar cenário é simulação, não edição em massa de lançamentos.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

![Tela: Simular fluxo de caixa](/help-media/finance/simular-fluxo-caixa.webp)
<!-- evidência: src/routes/_authenticated/finance.cash-flow.tsx; src/lib/finance.functions.ts -->
