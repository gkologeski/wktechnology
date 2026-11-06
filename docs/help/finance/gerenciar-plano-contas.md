---
module_key: finance
slug: gerenciar-plano-contas
title: Gerenciar plano de contas
summary: Gerenciar plano de contas no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/categories
min_permission: techfinance.categories.view.workspace
audience: internal
sort_order: 140
version: 2
is_published: true
---
# Gerenciar plano de contas

**Para que serve:** Gerenciar plano de contas, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.categories`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Gerenciar plano de contas (`/finance/categories`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Consulte as categorias disponíveis.
2. Use a criação para informar nome, código, tipo e categoria pai quando aplicável.
3. Salve e confira a estrutura exibida.
4. Use exclusão apenas se oferecida e autorizada para a categoria.

## Resultado esperado
Categoria financeira disponível para classificação de receitas ou despesas.

## Regras e limites
- Criação e exclusão têm permissões específicas; consultar não permite alterar.
- A interface não deve ser tratada como editor de funcionalidades não expostas.

### Campos e controles
Nome; código; tipo Receita/Despesa; categoria pai.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

![Tela: Gerenciar plano de contas](/help-media/finance/gerenciar-plano-contas.webp)
<!-- evidência: src/routes/_authenticated/finance.categories.tsx; src/lib/finance.functions.ts -->
