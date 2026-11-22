---
module_key: crm
slug: manter-modelos-de-proposta-comercial
title: Manter modelos de proposta comercial
summary: Manter modelos de proposta comercial.
article_type: howto
route_pattern: /settings/proposal-templates
min_permission: techsales.proposal_templates.view.workspace
audience: internal
sort_order: 158
version: 6
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

## Tabela de itens no final

A tabela de itens (Item | Cobrança) e o Total aparecem sempre no final do documento da proposta, na seção "Investimento", na tela, no link público e no PDF. Não é preciso colocar `{{{items_table}}}` no modelo; se o texto já trouxer a tabela, ela não é repetida no final.

## Modelo para contratação de fornecedora

O cadastro é reutilizável: salvar um modelo não cria uma Proposta Comercial nem um contrato. No campo **Modelo de contrato vinculado**, escolha um modelo publicado do mesmo workspace. A opção mostra o papel da WK: **contratante (compra)** ou **contratada (venda)**. A seleção exige acesso ao modelo de contrato. O vínculo identifica o modelo jurídico; não é número de um contrato assinado e não dispensa revisão jurídica ou assinatura.

No modelo de compra, `{{company.name}}`, `{{company_legal_name}}`, `{{company_cnpj}}` e `{{contact.name}}` identificam a fornecedora vinculada ao negócio. `{{contracting.name}}` e `{{contracting.cnpj}}` identificam a pessoa jurídica da WK selecionada no assistente. Confira a empresa antes de aplicar o modelo. Endereços, escopo, horas de referência, critérios, marcos e dados de um contrato efetivamente assinado continuam sujeitos ao preenchimento e à revisão por projeto. Não confunda o modelo jurídico vinculado com um contrato já celebrado.

O modelo **Fábrica de Software — contratação de fornecedora** prevê preço fechado por entrega, implantação pela WK, aceite expresso da WK, pagamento em dez dias úteis após aceite e nota fiscal válida e garantia de noventa dias. O cadastro do modelo não ativa serviços nem gera contas a receber ou a pagar.
