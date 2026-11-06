---
module_key: contracts
slug: decidir-aprovacao
title: Aprovar ou rejeitar uma etapa de contrato
summary: Aprovar ou rejeitar uma etapa de contrato no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id
min_permission:
audience: internal
sort_order: 33
version: 1
is_published: true
---
# Aprovar ou rejeitar uma etapa de contrato
**Para que serve:** Aprovar ou rejeitar uma etapa de contrato.
**Quem pode fazer:** Aprovação de techcontracts.approvals, com acesso à etapa e respeito ao responsável atribuído.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Etapa pendente; anteriores concluídas; contrato em revisão.

## Passo a passo
1. Abra o painel de aprovações.
2. Confira a etapa atual e sua atribuição.
3. Registre o comentário, obrigatório em rejeição.
4. Clique em "Aprovar" ou "Rejeitar".
5. Confira "Etapa aprovada" ou "Etapa rejeitada".
<!-- screenshot: Aprovar ou rejeitar uma etapa de contrato, sem dados pessoais reais -->

## Resultado esperado
Decisão registrada; rejeição leva a Em negociação e conclusão de todas as aprovações leva a Aguardando assinatura.

## Regras e limites
- Comentário até 2.000 caracteres.
- Não é permitido decidir etapa já decidida ou atribuída a outra pessoa.
- Aprovar não conclui assinatura nem ativa contrato.

## Erros comuns
"Informe o motivo da rejeição", "A etapa foi atribuída a outra pessoa." ou "Conclua a etapa anterior.": corrija a condição antes de decidir.

## Relacionados
- [Iniciar aprovações](/ajuda/contracts/iniciar-aprovacoes)
- [Registrar assinatura](/ajuda/contracts/registrar-assinatura)
