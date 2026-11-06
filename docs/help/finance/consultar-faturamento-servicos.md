---
module_key: finance
slug: consultar-faturamento-servicos
title: Consultar faturamento de serviços
summary: Consultar faturamento de serviços no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /services
min_permission: techfinance.entries.view.own
audience: internal
sort_order: 270
version: 2
is_published: true
---
# Consultar faturamento de serviços

**Para que serve:** Consultar faturamento de serviços, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro autorizado a consultar `techservice.services` (view.own, view.team ou view.workspace), sujeito ao módulo e às políticas próprias de serviços. A permissão `techfinance.entries.view` controla o atalho financeiro, mas não autoriza esta consulta. Ações exigem capacidade específica; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar faturamento de serviços (`/services`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra Faturamento de Serviços no menu financeiro.
2. Consulte a listagem e abra um serviço.
3. Confira situação, quantidade, preço unitário e datas antes de operar o faturamento.

## Resultado esperado
Acesso à listagem compartilhada de serviços e sua ficha.

## Regras e limites
- A rota pertence a uma funcionalidade compartilhada e possui controles de acesso próprios.
- Menu usa acesso de leitura de entries; isso não garante autorização para faturar.
- Não confundir /services com catálogo em /catalog/services.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

![Tela: Consultar faturamento de serviços](/help-media/finance/consultar-faturamento-servicos.webp)
<!-- evidência: src/routes/_authenticated/services.index.tsx; src/lib/menu-config-finance.ts -->
