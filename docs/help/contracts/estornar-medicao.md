---
module_key: contracts
slug: estornar-medicao
title: Devolver, cancelar ou estornar uma medição
summary: Devolver, cancelar ou estornar uma medição no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id/medicoes
min_permission:
audience: internal
sort_order: 75
version: 1
is_published: true
---
# Devolver, cancelar ou estornar uma medição
**Para que serve:** Devolver, cancelar ou estornar uma medição.
**Quem pode fazer:** Devolver exige aprovação ou gerenciamento de medições conforme verificação do servidor; estornar exige techprojects.measurement_reverse.manage.workspace.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Identificar situação, vínculo financeiro e pagamentos antes de escolher a ação.

## Passo a passo
1. Abra o detalhe da medição.
2. Para voltar a revisar, use a ação de devolução e informe a justificativa.
3. Para cancelar uma medição ainda não gerada, use o cancelamento permitido para a situação.
4. Para medição gerada, use o estorno e informe motivo com pelo menos 10 caracteres.
5. Confira a situação e o vínculo financeiro após a operação.
<!-- screenshot: Devolver, cancelar ou estornar uma medição, sem dados pessoais reais -->

## Resultado esperado
Devolução retorna a Rascunho; estorno termina em Estornada, conforme a ação e suas regras.

## Regras e limites
- Cancelamento não substitui estorno de medição gerada.
- Título criado pela medição: estorno cancela-o somente quando permitido.
- Título legado: estorno apenas desfaz o vínculo e preserva o título.
- Pagamento, baixa ou registro bancário no título gerado bloqueia estorno.
- Estorno não é devolução bancária nem desfaz recebimento automaticamente.

## Erros comuns
REVERSE_BLOCKED: resolva pagamentos, baixas ou dependências no Financeiro antes de tentar.

## Relacionados
- [Gerar título ou vincular legado](/ajuda/contracts/gerar-medicao-financeiro)
