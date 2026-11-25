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
version: 10
is_published: true
---

# Manter modelos de proposta comercial

**Para que serve:** Manter modelos de proposta comercial, no contexto da tela `/settings/proposal-templates`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.proposal_templates`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/proposal-templates`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo

1. Abra /settings/proposal-templates.
2. Use o menu de ações (`⋯`) em cada modelo da lista para **Editar**, **Duplicar** ou **Excluir**, ou clique em **Novo modelo visual** (editor de páginas) ou **Novo em texto** (texto rico).
3. Ao **Duplicar**, o sistema cria uma cópia com o mesmo conteúdo, descrição, serviços do catálogo e modelo de contrato vinculado, nomeada como `<nome> (cópia)` (ou `(cópia 2)` se já existir), e abre a cópia pronta para edição.
4. Revise Nome, Descrição, serviços vinculados e Conteúdo no editor e clique em **Salvar**. Se tentar trocar de modelo com alterações não salvas, confirme se deseja descartá-las.
5. Para **Excluir**, confirme no diálogo exibido (na lista ou no rodapé do editor). Propostas já criadas não são afetadas.

## Modelos visuais em páginas

Além do formato em **Texto rico**, é possível criar modelos **Visual (páginas)** em formato A4 (retrato ou paisagem) com múltiplos quadros e páginas:

- **Painel esquerdo:** aplique um modelo pronto como ponto de partida — **Proposta Editorial (5 págs.)** ou **Consultoria (6 págs.)** —, adicione formas, cartões comerciais, ícones, tipografia, campos dinâmicos (`{{company.name}}`, `{{company.logo}}`, `{{provider.logo}}`, `{{counterparty.name}}`, `{{signer.full_name}}`, `{{total}}`, `{{valid_until}}`, etc.), configure o **Kit da Marca** (cores, fontes e empresa prestadora) ou envie imagens privadas (PNG, JPG, WebP, GIF ou SVG até 5 MB). Em elementos de imagem, você pode vincular a origem dinâmica ao **Logo da empresa cliente** (puxado do cadastro de **Empresas**) ou ao **Logo da prestadora**.
- **Canvas e Página Mestre:** arraste, redimensione, gire, alinhe com guias magnéticas, dê duplo clique nos textos para editar inline, controle camadas/grupos e edite a **Página mestre** para repetir cabeçalho, rodapé e numeração automática (`{{page.number_padded}}`) nas páginas internas.
- **Blocos dinâmicos:** tabelas vinculadas aos itens da proposta e cartões repetíveis por serviço preenchem automaticamente os dados reais da cotação/proposta.
- **Pré-visualização e saída única:** clique em **Pré-visualizar** para testar com uma proposta real do workspace. A renderização é a mesma na ficha interna, no link público `/proposal/<token>` e no PDF.
- **Compatibilidade:** modelos antigos em texto rico continuam funcionando sem alterações obrigatórias.

## Resultado esperado

A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites

Modelos de proposta são próprios e podem se vincular ao catálogo de serviços; não são cláusulas de contrato. Edição do documento final da proposta ocorre pelo ProposalWizard. As ações respeitam as permissões efetivas do cargo em `techsales.proposal_templates` (`update` para editar, `create` para criar ou duplicar e `delete` para excluir) no workspace ativo.

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

Além das variáveis da lista, os modelos aceitam: `{{company.logo}}` (logo da empresa cliente cadastrada em **Empresas**, seguindo logo manual → domínio → oculto), `{{provider.logo}}` (logo da empresa prestadora selecionada, com fallback para o workspace), `{{company_legal_name}}` (razão social), `{{company_cnpj}}`, `{{payment_method}}`, `{{installments_count}}`, `{{installments_due_day}}`, `{{installment_value}}`, `{{validity_days}}`, `{{counterparty.name}}` (empresa cliente), `{{signer.full_name}}`, `{{signer.cpf}}`, `{{signer.email}}` (signatário legal único da empresa ou, na falta, o contato da proposta) e `{{{terms_block}}}` (seção "Condições comerciais" completa, atualizada automaticamente no assistente). Os modelos oficiais já trazem `{{{terms_block}}}` antes da validade. Quando a empresa não tem logo cadastrado, a imagem é omitida no texto rico e fica como espaço vazio discreto no editor visual.

## Tabela de itens no final

A tabela de itens (Item | Cobrança) e o Total aparecem sempre no final do documento da proposta, na seção "Investimento", na tela, no link público e no PDF. Não é preciso colocar `{{{items_table}}}` no modelo; se o texto já trouxer a tabela, ela não é repetida no final.

## Modelo para contratação de fornecedora

O cadastro é reutilizável: salvar um modelo não cria uma Proposta Comercial nem um contrato. No campo **Modelo de contrato vinculado**, escolha um modelo publicado do mesmo workspace. A opção mostra o papel da WK: **contratante (compra)** ou **contratada (venda)**. A seleção exige acesso ao modelo de contrato. O vínculo identifica o modelo jurídico; não é número de um contrato assinado e não dispensa revisão jurídica ou assinatura.

No modelo de compra, `{{company.name}}`, `{{company_legal_name}}`, `{{company_cnpj}}` e `{{contact.name}}` identificam a fornecedora vinculada ao negócio. `{{contracting.name}}` e `{{contracting.cnpj}}` identificam a pessoa jurídica da WK selecionada no assistente. Confira a empresa antes de aplicar o modelo. Endereços, escopo, horas de referência, critérios, marcos e dados de um contrato efetivamente assinado continuam sujeitos ao preenchimento e à revisão por projeto. Não confunda o modelo jurídico vinculado com um contrato já celebrado.

O modelo **Fábrica de Software — contratação de fornecedora** prevê preço fechado por entrega, implantação pela WK, aceite expresso da WK, pagamento em dez dias úteis após aceite e nota fiscal válida e garantia de noventa dias. O cadastro do modelo não ativa serviços nem gera contas a receber ou a pagar.
