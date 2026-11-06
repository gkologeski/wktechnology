---
module_key: finance
slug: consultar-contas-a-receber
title: Consultar contas a receber
summary: Consultar contas a receber no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/receivable
min_permission: techfinance.entries.view.own
audience: internal
sort_order: 40
version: 1
is_published: true
---
# Consultar contas a receber

**Para que serve:** Consultar contas a receber, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.entries`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar contas a receber (`/finance/receivable`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Busque pela descrição e selecione status, empresa ou grupo e responsável.
2. Alterne lista e Kanban e ajuste as colunas quando necessário.
3. Abra a descrição para consultar a ficha ou use o botão de baixa se autorizado.
4. Selecione registros para editar vencimento/competência ou excluir em lote, somente quando todos os registros permitirem a ação.
5. Use Exportar se autorizado; o servidor confere novamente o acesso.

## Resultado esperado
Títulos da direção selecionada, com saldo em aberto e ações condicionadas por registro.

## Regras e limites
- Kanban é somente leitura para mudança de status: status deriva das baixas.
- Exportação exige `techfinance.entries.export.workspace`.
- Seleção global corresponde aos registros filtrados carregados, não é garantia de consulta ilimitada.
- Edição em lote não dá autorização adicional.

### Campos e controles
Descrição, contraparte, categoria, status, valor, em aberto, vencimento e responsável. Status: Em aberto, Parcial, Pago, Vencido e Cancelado.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar contas a receber; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/components/finance/entries-list-page.tsx; src/lib/finance.functions.ts -->
