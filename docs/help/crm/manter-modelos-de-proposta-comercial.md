---
module_key: crm
slug: manter-modelos-de-proposta-comercial
title: Manter modelos de proposta comercial
summary: Manter modelos de proposta comercial.
article_type: howto
route_pattern: /settings/proposal-templates
min_permission: 
audience: internal
sort_order: 158
version: 4
is_published: true
---
# Manter modelos de proposta comercial

**Para que serve:** Manter modelos de proposta comercial, no contexto da tela `/settings/proposal-templates`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.proposal_templates`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/proposal-templates`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/proposal-templates.
2. Revise Nome, Descrição e Conteúdo no editor.
3. Confira o documento antes de salvar.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Modelos de proposta são próprios e podem se vincular ao catálogo de serviços; não são cláusulas de contrato. Edição do documento final da proposta ocorre pelo ProposalWizard.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

![Tela: capturar /settings/proposal-templates com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/crm/manter-modelos-de-proposta-comercial.webp)

## Variáveis de condições comerciais

Além das variáveis da lista, os modelos aceitam: `{{company_legal_name}}` (razão social), `{{company_cnpj}}`, `{{payment_method}}`, `{{installments_count}}`, `{{installments_due_day}}`, `{{installment_value}}`, `{{validity_days}}`, `{{counterparty.name}}` (empresa cliente), `{{signer.full_name}}`, `{{signer.cpf}}`, `{{signer.email}}` (signatário legal único da empresa ou, na falta, o contato da proposta) e `{{{terms_block}}}` (seção "Condições comerciais" completa, atualizada automaticamente no assistente). Os modelos oficiais já trazem `{{{terms_block}}}` antes da validade.
