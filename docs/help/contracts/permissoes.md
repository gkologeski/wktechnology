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
version: 1
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
| Histórico de aprovação | techcontracts.audit: view |
| Modelos | techcontracts.contract_templates: view, create, update, delete |
| Padrões | techcontracts.defaults: view; salvar exige manage e techcontracts.contracts.update.workspace |
| Serviços | techservice.services: view, create, update, delete no escopo aplicável |
| Associação ao catálogo | Caminho da ficha exige techservice.services.create.own |
| Evidência de assinatura | techcontracts.signature_evidence.view.workspace; gerenciar exige manage.workspace e capacidade do servidor |
| Preparação de assinatura | Também criação em techcontracts.esign no escopo aceito |
| Medições | Leitura do contrato + techprojects.billing_config / measurements / profitability, conforme seção |
| Provisões | techfinance.provisions e acesso a tarifas de TechProjects, conforme ação |

Escopos own, team e workspace não são intercambiáveis. Um botão visível não comprova autorização. Responsável pelo cadastro é informação operacional, não substitui controle de acesso.

## Ações especiais
Enviar, cancelar e compartilhar assinatura, aprovar ou gerar medição e revisar provisões possuem verificações próprias. Acesso ao módulo não concede essas ações. Para mudar acesso, procure o responsável pelas permissões; não use outra conta nem tente contornar pela URL.

## Divergências
O material preserva o comportamento existente. Diferenças entre menu, tela e controle do servidor estão em docs/help/divergencias.md; nenhuma permissão foi ampliada nesta entrega.

## Relacionados
- [Aprovações](/ajuda/contracts/iniciar-aprovacoes)
- [Medições](/ajuda/contracts/preparar-medicao)
