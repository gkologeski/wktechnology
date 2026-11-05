---
module_key: finance
slug: gerenciar-cobrancas-bancarias
title: Gerenciar cobranças bancárias
summary: Gerenciar cobranças bancárias no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/banking
min_permission: techfinance.banking.view.workspace
audience: internal
sort_order: 200
version: 1
is_published: true
---
# Gerenciar cobranças bancárias

**Para que serve:** Gerenciar cobranças bancárias, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.banking`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Gerenciar cobranças bancárias (`/finance/banking`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Confira a conexão e abra Cobranças.
2. Use a criação autorizada e preencha tipo, vencimento, valor, pagador, documento e descrição.
3. Confira o resultado e os dados de cobrança disponibilizados, como copia e cola ou linha digitável.
4. Cancele somente quando autorizado.
5. Simule liquidação apenas se a conexão for mock e a simulação estiver habilitada.

## Resultado esperado
Cobrança registrada conforme o modo e adaptador; não comprova recebimento real.

## Regras e limites
- Emissão usa `techfinance.bank_charge_issuance.manage.workspace`; cancelamento usa `techfinance.bank_charge_cancellation.manage.workspace`.
- Simulação exige `techfinance.banking_simulation.manage.workspace` e modo mock.
- Falha ou bloqueio de adaptador não autoriza afirmar que um boleto/Pix real foi emitido.

### Campos e controles
Tipo; vencimento; valor; pagador; documento; descrição.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Gerenciar cobranças bancárias; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/routes/_authenticated/finance.banking.tsx -->
