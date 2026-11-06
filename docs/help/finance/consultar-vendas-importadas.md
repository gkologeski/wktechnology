---
module_key: finance
slug: consultar-vendas-importadas
title: Consultar vendas importadas
summary: Consultar vendas importadas no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/sales
min_permission: techfinance.sales.view.workspace
audience: internal
sort_order: 230
version: 2
is_published: true
---
# Consultar vendas importadas

**Para que serve:** Consultar vendas importadas, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.sales`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar vendas importadas (`/finance/sales`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Busque vendas usando os filtros de texto, status e período disponíveis.
2. Confira as linhas e os indicadores apresentados.
3. Use a navegação/paginação quando disponível e mantenha os filtros ao comparar valores.

## Resultado esperado
Consulta de vendas importadas do Conta Azul.

## Regras e limites
- Tela somente leitura: não há criação/edição de venda confirmada.
- Chave do menu: `techfinance.sales.view.workspace`.
- Existência de venda importada não comprova baixa do título.
- Conexão e importação são operações da integração Conta Azul, não desta listagem.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

![Tela: Consultar vendas importadas](/help-media/finance/consultar-vendas-importadas.webp)
<!-- evidência: src/routes/_authenticated/finance.sales.tsx; src/lib/finance-sales.functions.ts -->
