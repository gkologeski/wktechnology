---
module_key: finance
slug: consultar-dre
title: Consultar e exportar a DRE gerencial
summary: Consultar e exportar a DRE gerencial no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/dre
min_permission: techfinance.reports.view.workspace
audience: internal
sort_order: 120
version: 1
is_published: true
---
# Consultar e exportar a DRE gerencial

**Para que serve:** Consultar e exportar a DRE gerencial, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.reports`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar e exportar a DRE gerencial (`/finance/dre`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Escolha Competência ou Caixa.
2. Selecione empresa/grupo e últimos 3, 6 ou 12 meses.
3. Confira receitas, despesas, categorias e resultado mensal.
4. Quando disponível para seu acesso, exporte CSV.

## Resultado esperado
Demonstrativo gerencial no regime, período e escopo selecionados.

## Regras e limites
- Competência usa competência; Caixa usa a data de pagamento.
- Exportação exige `techfinance.reports.export.workspace` e autorização do servidor.
- Não há importação de DRE confirmada nesta tela.
- Consolidação por grupo pode eliminar intercompany; confira a indicação da tela.
- Não substitui demonstração contábil formal.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar e exportar a DRE gerencial; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.dre.tsx; src/lib/finance.functions.ts -->
