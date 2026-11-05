---
module_key: contracts
slug: gerar-medicao-financeiro
title: Gerar título financeiro ou vincular título legado da medição
summary: Gerar título financeiro ou vincular título legado da medição no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id/medicoes
min_permission:
audience: internal
sort_order: 74
version: 1
is_published: true
---
# Gerar título financeiro ou vincular título legado da medição
**Para que serve:** Gerar título financeiro ou vincular título legado da medição.
**Quem pode fazer:** techprojects.measurement_finance.create.workspace e techfinance.entries.create.own, com acesso ao registro.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Medição pronta para o Financeiro, pendências resolvidas e vencimento definido.

## Passo a passo
1. Abra a medição e confira "Pendências para o Financeiro".
2. Se pronta, preencha "Vencimento" e clique em "Gerar no Financeiro".
3. Quando o fluxo oferecer vínculo legado, selecione o título existente correspondente em vez de criar outro.
4. Confira o vínculo financeiro e o resultado da operação.
<!-- screenshot: Gerar título financeiro ou vincular título legado da medição, sem dados pessoais reais -->

## Resultado esperado
Título interno a receber criado ou título legado vinculado, sem emissão de nota fiscal, boleto ou envio de cobrança.

## Regras e limites
- Geração exige estado pronto; na interface também pode ser retomada em falha. Apenas aprovada ainda fica desabilitada.
- Geração concluída é idempotente: repetição retorna o vínculo existente.
- Legado exige mesmo workspace, serviço, competência, moeda e valor; título não cancelado e sem outro vínculo ativo.
- Vínculo legado não cria um novo título. Outros legados não resolvidos podem bloquear.
- Título lançado não comprova recebimento.

## Erros comuns
GENERATE_BLOCKED: resolva os impedimentos. LEGACY_AMOUNT_MISMATCH: ajuste medição ou resolva no Financeiro.
"A aprovação foi mantida; tente de novo": falha capturada não comprova título criado.

## Relacionados
- [Estornar ou cancelar medição](/ajuda/contracts/estornar-medicao)
- [Aprovar medição](/ajuda/contracts/aprovar-medicao)
