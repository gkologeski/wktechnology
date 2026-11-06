---
module_key: finance
slug: gerenciar-faturas
title: Gerenciar faturas
summary: Gerenciar faturas no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /invoices
min_permission: techfinance.invoices.view.workspace
audience: internal
sort_order: 260
version: 2
is_published: true
---
# Gerenciar faturas

**Para que serve:** Gerenciar faturas, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.invoices`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Gerenciar faturas (`/invoices`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Busque por número ou descrição e filtre status, gateway, vencimento, valor e empresa.
2. Use a criação autorizada e confira dados e vencimento antes de salvar.
3. Consulte links de cobrança oferecidos no registro; copie o link quando necessário.
4. Marque como paga ou exclua apenas quando a capacidade do registro permitir.
5. Para ajuste em lote, selecione registros e revise a alteração de vencimento.
6. A emissão NFS-e é oferecida como ação, mas no servidor atual retorna indisponibilidade.

## Resultado esperado
Faturas consultadas ou alteradas conforme autorização, sem presumir emissão fiscal.

## Regras e limites
- Tela compartilhada, acessível também por chaves techsales.invoices indicadas no menu.
- Status: Rascunho, Em aberto, Paga, Vencida, Cancelada e Reembolsada.
- Kanban não libera mudança arbitrária de status.
- Exportação e capacidades de quitação/exclusão são controladas no servidor.
- Fatura paga e baixa de lançamento são conceitos distintos; confira vínculos, não deduza sincronização universal.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

![Tela: Gerenciar faturas](/help-media/finance/gerenciar-faturas.webp)
<!-- evidência: src/routes/_authenticated/invoices.tsx; src/lib/access-control/use-finance-business-capabilities.ts -->
