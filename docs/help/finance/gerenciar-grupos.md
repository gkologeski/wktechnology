---
module_key: finance
slug: gerenciar-grupos
title: Gerenciar grupos empresariais
summary: Gerenciar grupos empresariais no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/legal-entity-groups
min_permission: techfinance.legal_entity_groups.view.workspace
audience: internal
sort_order: 170
version: 2
is_published: true
---
# Gerenciar grupos empresariais

**Para que serve:** Gerenciar grupos empresariais, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.legal_entity_groups`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Gerenciar grupos empresariais (`/finance/legal-entity-groups`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Crie um grupo e informe código, nome e descrição.
2. Marque os CNPJs integrantes e a situação ativa.
3. Salve e confira a composição.
4. Edite ou exclua somente quando a ação do registro estiver autorizada.
5. Use o grupo no filtro de relatórios para consultar o consolidado.

## Resultado esperado
Agrupamento de empresas disponível nos filtros compatíveis.

## Regras e limites
- Nome do grupo é obrigatório.
- Grupo empresarial não é grupo de usuários nem concede permissões.
- Relatórios podem eliminar operações intercompany internas ao grupo.

### Campos e controles
Código; nome; descrição; ativo; seleção de CNPJs integrantes.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

![Tela: Gerenciar grupos empresariais](/help-media/finance/gerenciar-grupos.webp)
<!-- evidência: src/components/finance/legal-entity-groups-page.tsx; src/components/finance/legal-entity-select.tsx -->
