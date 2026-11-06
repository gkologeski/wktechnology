---
module_key: finance
slug: consultar-dashboard
title: Consultar o Dashboard
summary: Consultar o Dashboard no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance
min_permission: techfinance.entries.view.own
audience: internal
sort_order: 30
version: 2
is_published: true
---
# Consultar o Dashboard

**Para que serve:** Consultar o Dashboard, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.entries`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar o Dashboard (`/finance`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra Visão geral > Dashboard.
2. Confira os indicadores e os alertas operacionais disponíveis.
3. Use os atalhos A receber e A pagar para investigar os títulos.
4. Se autorizado, use Novo lançamento para abrir o cadastro rápido.

## Resultado esperado
Visão resumida da carteira financeira acessível ao usuário.

## Regras e limites
- Indicadores são limitados ao escopo consultável, não necessariamente ao workspace inteiro.
- Criar exige `techfinance.entries.create.own` ou `.create.workspace`.
- Alertas não comprovam execução de cobrança ou pagamento.
- As quatro listas de alertas são consultadas em paralelo e respeitam o workspace ativo, as permissões efetivas e o escopo de cada registro.
- Uma falha de consulta mostra um aviso e a ação Tentar novamente; não é apresentada como ausência de alertas.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar o Dashboard; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.index.tsx; src/components/finance/finance-alerts-panel.tsx -->
