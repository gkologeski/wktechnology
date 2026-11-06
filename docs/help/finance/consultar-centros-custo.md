---
module_key: finance
slug: consultar-centros-custo
title: Consultar centros de custo
summary: Consultar centros de custo no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/cost-centers
min_permission: techfinance.cost_centers.view.workspace
audience: internal
sort_order: 150
version: 2
is_published: true
---
# Consultar centros de custo

**Para que serve:** Consultar centros de custo, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.cost_centers`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar centros de custo (`/finance/cost-centers`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra Centros de custo.
2. Consulte a hierarquia e os CNPJs associados apresentados.
3. Compare a estrutura para entender a distribuição por empresa.

## Resultado esperado
Estrutura consultada, sem cadastro ou edição nesta tela.

## Regras e limites
- Não há botões de criar, editar ou excluir confirmados nesta rota.
- Permissões de escrita existentes no catálogo não provam que haja ação de escrita na interface.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

![Tela: Consultar centros de custo](/help-media/finance/consultar-centros-custo.webp)
<!-- evidência: src/routes/_authenticated/finance.cost-centers.tsx -->
