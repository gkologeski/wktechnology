---
module_key: finance
slug: parcelar-lancamento
title: Parcelar lançamento
summary: Parcelar lançamento no TechFinance: operação, acesso e limites confirmados no código.
article_type: howto
route_pattern: /finance/payable
min_permission: techfinance.entries.view.own
audience: internal
sort_order: 70
version: 1
is_published: true
---
# Parcelar lançamento

**Para que serve:** Parcelar lançamento, usando os controles disponíveis nesta tela.

**Quem pode fazer:** Membro ativo no workspace, com módulo liberado e acesso de leitura ao recurso `techfinance.entries`. Ações de escrita exigem a permissão específica e, quando aplicável, autorização sobre cada registro; ver [Permissões](/ajuda/finance/permissoes).

**Onde fica:** TechFinance > Financeiro > Parcelar lançamento (`/finance/payable`).

**Antes de começar:** Confira o workspace e suas permissões; utilize somente registros aos quais tem acesso. Para operações externas, confirme a disponibilidade do adaptador e o modo de execução.

## Passo a passo
1. Abra Novo lançamento e preencha tipo, descrição e valor total.
2. Ative Parcelar e escolha de 2 a 120 parcelas.
3. Escolha Mensal, Semanal ou Dias fixos; neste último, informe o intervalo.
4. Escolha ajuste de centavos na primeira ou na última parcela e confira a prévia.
5. Salve e confira os títulos e vencimentos na listagem.

## Resultado esperado
Grupo de parcelas cujo somatório corresponde ao total.

## Regras e limites
- Parcelamento reparte um total; recorrência repete uma agenda.
- Intervalo personalizado no servidor: 1 a 365 dias.
- Mensal ajusta o vencimento ao último dia válido quando necessário.
- A ficha oferece exclusão das parcelas em aberto conforme autorização, preservando parcelas que não podem ser excluídas.

### Campos e controles
Número de parcelas; cadência; intervalo; ajuste de centavos; prévia de valores e datas.

## Erros comuns
Soma das parcelas diferente do total: revise valores e arredondamento. Intervalos acima de 365 podem ser rejeitados mesmo que digitáveis na interface.

## Relacionados
- [Campos e status](/ajuda/finance/campos-e-status)
- [Permissões](/ajuda/finance/permissoes)
- [Erros comuns](/ajuda/finance/erros-comuns)

<!-- screenshot: Parcelar lançamento; capturar apenas ambiente demonstrativo sem dados pessoais ou credenciais. -->
<!-- evidência: src/components/finance/quick-create-entry-dialog.tsx; src/lib/finance.functions.ts -->
