---
module_key: contracts
slug: configurar-aprovadores-minuta
title: Escolher os aprovadores jurídicos da minuta
summary: Definir quem revisa e aprova a minuta de contrato enviada após o aceite da proposta.
article_type: howto
route_pattern: /settings/contract-draft-approvers
min_permission: techcontracts.contract_draft_approvers.manage.workspace
audience: internal
sort_order: 41
version: 1
is_published: true
---
# Escolher os aprovadores jurídicos da minuta
**Para que serve:** Indicar quem recebe o aviso "Minuta aguardando revisão".
**Quem pode fazer:** Quem tem "Gerenciar aprovadores de minuta" no cargo.
**Onde fica:** TechContracts > Configurações > Aprovação de minuta (/settings/contract-draft-approvers).

## Passo a passo
1. Abra a tela e busque o membro pelo nome.
2. Marque até 20 pessoas e clique em "Salvar aprovadores".
3. Confira em Configurações > Permissões se cada uma tem "Ver minutas de contrato" e "Aprovar minuta de contrato".

## Regras
- Somente membros ativos do workspace podem ser escolhidos.
- Sem aprovador configurado, o responsável do workflow é avisado para configurar.
- Nenhuma permissão é dada automaticamente ao marcar a pessoa.
