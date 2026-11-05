---
module_key: finance
slug: operar-servico
title: Consultar e operar serviço faturável
summary: Consultar e operar serviço faturável no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /services/$id
min_permission: techfinance.entries.view.own
audience: internal
sort_order: 280
version: 1
is_published: true
---
# Consultar e operar serviço faturável

**Para que serve:** Consultar e operar serviço faturável, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.entries`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Consultar e operar serviço faturável (`/services/$id`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra o serviço a partir da listagem.
2. Confira nome, descrição, status, cadência, quantidade, preço unitário, início e fim.
3. Salve alterações somente se autorizado.
4. Se pendente e autorizado, use Ativar; consulte o resultado.
5. Exclua somente com capacidade de exclusão válida e após confirmação.

## Resultado esperado
Serviço consultado ou alterado conforme autorização, sem presumir emissão de cobrança externa.

## Regras e limites
- Cadências expostas: mensal, trimestral e anual.
- Faturar exige `techservice.billing.manage.workspace` em conjunto com as chaves financeiras verificadas na rota.
- Ações também dependem das capacidades do serviço.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Consultar e operar serviço faturável; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/services.$id.tsx -->
