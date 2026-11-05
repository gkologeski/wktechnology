---
module_key: contracts
slug: alterar-status
title: Alterar o status de um contrato
summary: Alterar o status de um contrato no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id
min_permission:
audience: internal
sort_order: 31
version: 1
is_published: true
---
# Alterar o status de um contrato
**Para que serve:** Alterar o status de um contrato.
**Quem pode fazer:** Atualização do registro e techcontracts.contract_transition.manage.workspace; para Ativo também techcontracts.contract_activation.manage.workspace.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Conferir aprovações pendentes e evidências necessárias.

## Passo a passo
1. Abra a ficha.
2. Escolha um status permitido no campo "Status".
3. Clique em "Salvar".
4. Para "Em revisão" ou "Aguardando assinatura", use o fluxo de aprovações em vez da mudança manual.
<!-- screenshot: Alterar o status de um contrato, sem dados pessoais reais -->

## Resultado esperado
Status atualizado somente quando autorizado pelas regras de transição.

## Regras e limites
- Status: Rascunho, Em revisão, Em negociação, Aguardando assinatura, Ativo, Renovando, Encerrado, Rescindido.
- Aprovação pendente pode impedir transição.
- Ativo não comprova assinatura. Aprovação completa não ativa automaticamente o contrato.

## Erros comuns
"Use o fluxo de aprovações para esta situação." ou "Conclua ou reinicie o fluxo de aprovação antes de alterar a situação.": conclua o processo correto.
"Edição não autorizada.": revise seu acesso.

## Relacionados
- [Iniciar aprovações](/ajuda/contracts/iniciar-aprovacoes)
