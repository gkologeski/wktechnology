---
module_key: finance
slug: estornar-baixa
title: Estornar baixa
summary: Estornar baixa no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/entries/$id
min_permission: techfinance.entries.view.own
audience: internal
sort_order: 100
version: 1
is_published: true
---
# Estornar baixa

**Para que serve:** Estornar baixa, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.entries`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Estornar baixa (`/finance/entries/$id`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra o título e localize a baixa no histórico.
2. Use a ação de estorno disponível para o pagamento.
3. Confirme a operação e consulte novamente histórico, saldo e status.

## Resultado esperado
Baixa revertida conforme o resultado do servidor, com recálculo do saldo do título.

## Regras e limites
- Exige capacidade `can_reverse`.
- Estorno de baixa não significa devolução bancária, cancelamento de cobrança ou cancelamento de NFS-e.
- Não exclua o título para corrigir um pagamento.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Estornar baixa; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.entries.$id.tsx; src/lib/finance.functions.ts -->
