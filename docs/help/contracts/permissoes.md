---
module_key: contracts
slug: permissoes
title: Permissões do TechContracts
summary: Permissões do TechContracts no TechContracts, com as regras e limites disponíveis no sistema.
article_type: reference
route_pattern: 
min_permission:
audience: internal
sort_order: 3
version: 3
is_published: true
---
# Permissões do TechContracts
## Acesso à Ajuda
Artigos internos usam o acesso ao módulo e às permissões efetivas do workspace. O menu TechContracts não declara uma chave mínima individual por item; estes artigos deixam a chave mínima vazia, sem inventar uma permissão. Isso não libera ações no contrato.

## Recursos e ações
| Área | Recurso / exigência |
|---|---|
| Contratos | techcontracts.contracts: leitura, criação, atualização, exclusão e exportação conforme escopo |
| Mudança de status | Atualização do registro + techcontracts.contract_transition.manage.workspace |
| Ativação manual | Também techcontracts.contract_activation.manage.workspace |
| Aprovações | techcontracts.approvals: view, manage, approve conforme ação |
| Assumir aprovação pendente | techcontracts.approval_substitution.manage.workspace + gestão e aprovação de etapas, leitura e atualização do contrato; exige justificativa e preserva a ordem da cadeia |
| Histórico de aprovação | techcontracts.audit: view |
| Modelos | techcontracts.contract_templates: view, create, update, delete |
| Padrões | techcontracts.defaults: view; salvar exige manage e techcontracts.contracts.update.workspace |
| Serviços | techservice.services: view, create, update, delete no escopo aplicável |
| Concluir execução | Atualização do serviço + techservice.service_execution.manage.workspace; não concede faturamento |
| Gerar link de aceite | Leitura e atualização do contrato + techcontracts.contract_acceptance.manage.workspace e techcontracts.esign_share.manage.workspace (Compartilhar links de assinaturas eletrônicas — workspace) |
| Revogar links de aceite | Leitura e atualização do contrato + techcontracts.contract_acceptance.manage.workspace; retirar o acesso ao link não exige a autoridade adicional de compartilhamento |
| Registrar aceite recebido | Leitura e atualização do contrato + techcontracts.contract_acceptance.approve.workspace, com evidência do cliente |
| Liberar faturamento por aceite | Aceite vigente de contrato de prestação + techcontracts.contract_acceptance_billing.manage.workspace, cobrança e criação/leitura financeira verificadas no servidor |
| Associação ao catálogo | Caminho da ficha exige techservice.services.create.own |
| Evidência de assinatura | techcontracts.signature_evidence.view.workspace; gerenciar exige manage.workspace e capacidade do servidor |
| Preparação de assinatura | Também criação em techcontracts.esign no escopo aceito |
| Medições | Leitura do contrato + techprojects.billing_config / measurements / profitability, conforme seção |
| Provisões | techfinance.provisions e acesso a tarifas de TechProjects, conforme ação |

Escopos own, team e workspace não são intercambiáveis. Um botão visível não comprova autorização. Responsável pelo cadastro é informação operacional, não substitui controle de acesso.

A permissão existente **Compartilhar links de assinaturas eletrônicas — workspace** (`techcontracts.esign_share.manage.workspace`) representa a autoridade para compartilhar publicamente o contrato. Gerar links de aceite exige também a permissão específica de aceite. A revogação utiliza a autorização de gerenciar o aceite e o acesso ao contrato. O aceite comercial continua separado da assinatura e não preenche assinaturas do cliente.

## Ações especiais
Enviar, cancelar e compartilhar assinatura, aprovar ou gerar medição e revisar provisões possuem verificações próprias. Acesso ao módulo não concede essas ações. Para mudar acesso, procure o responsável pelas permissões; não use outra conta nem tente contornar pela URL.

## Divergências
O material preserva o comportamento existente. Diferenças entre menu, tela e controle do servidor estão em docs/help/divergencias.md; nenhuma permissão foi ampliada nesta entrega.

## Relacionados
- [Aprovações](/ajuda/contracts/iniciar-aprovacoes)
- [Medições](/ajuda/contracts/preparar-medicao)
- [Aceite comercial do contrato](/ajuda/contracts/aceitar-contrato)
- [Concluir execução](/ajuda/contracts/concluir-execucao-servico)
