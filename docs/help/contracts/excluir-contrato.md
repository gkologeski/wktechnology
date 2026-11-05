---
module_key: contracts
slug: excluir-contrato
title: Excluir um contrato
summary: Excluir um contrato no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id
min_permission:
audience: internal
sort_order: 39
version: 1
is_published: true
---
# Excluir um contrato
**Para que serve:** Excluir um contrato.
**Quem pode fazer:** Capacidade de exclusão de techcontracts.contracts para o registro.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Revisar dependências antes de remover. Não usar exclusão para encerrar uma vigência.

## Passo a passo
1. Abra o contrato correto.
2. Clique na ação "Excluir".
3. Confirme "Excluir este contrato?" somente após revisar o impacto.
<!-- screenshot: Excluir um contrato, sem dados pessoais reais -->

## Resultado esperado
"Contrato excluído." e retorno à lista.

## Regras e limites
- Excluir remove o cadastro; encerrar e rescindir são estados distintos.
- Não presuma remoção automática de todos os serviços, medições ou vínculos. Dependências podem bloquear a operação.

## Erros comuns
"Você não tem permissão para excluir este registro.": solicite revisão do seu acesso.

## Relacionados
- [Alterar status](/ajuda/contracts/alterar-status)
