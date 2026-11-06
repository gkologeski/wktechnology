---
module_key: finance
slug: cadastrar-conta-bancaria
title: Cadastrar e consultar contas bancárias
summary: Cadastrar e consultar contas bancárias no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/bank-accounts
min_permission: techfinance.bank_accounts.view.workspace
audience: internal
sort_order: 180
version: 2
is_published: true
---
# Cadastrar e consultar contas bancárias

**Para que serve:** Cadastrar e consultar contas bancárias, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.bank_accounts`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Cadastrar e consultar contas bancárias (`/finance/bank-accounts`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Consulte as contas existentes.
2. Use a criação e informe nome, empresa opcional, tipo e saldo inicial.
3. Salve e confira a linha criada.
4. Exporte pela barra da listagem quando autorizado.

## Resultado esperado
Conta interna disponível como referência nas operações financeiras.

## Regras e limites
- Tipos: Conta corrente, Poupança, Caixa e Outro.
- Cadastro de conta interna não cria conexão com Banco Inter.
- Criação exige `techfinance.bank_accounts.create.workspace`; exportação exige `.export.workspace`.
- Não foi confirmado editor completo de dados bancários nesta tela.

### Campos e controles
Nome; empresa; tipo; saldo inicial.

## Erros comuns
Se a tela ou ação estiver indisponível, confira permissões e acesso ao registro. Em falha de gravação, não presuma sucesso: recarregue a consulta antes de repetir. Ausência de resultados pode decorrer de filtros ou do escopo autorizado.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

![Tela: Cadastrar e consultar contas bancárias](/help-media/finance/cadastrar-conta-bancaria.webp)
<!-- evidência: src/routes/_authenticated/finance.bank-accounts.tsx -->
