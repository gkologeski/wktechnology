---
module_key: crm
slug: atualizar-negocio
title: Atualizar um negócio
summary: Atualizar o funil e consultar cotações, propostas e contratos vinculados ao negócio.
article_type: howto
route_pattern: /deals/$id
min_permission:
audience: internal
sort_order: 201
version: 1
is_published: true
---
# Atualizar um negócio
**Para que serve:** Manter o negócio atualizado e acompanhar os documentos comerciais vinculados.
**Quem pode fazer:** Membros ativos com TechSales licenciado e acesso ao negócio. Alterações exigem permissão de atualização em `techsales.deals`; a exclusão exige permissão de exclusão no escopo do registro.
**Onde fica:** Menu > TechSales > Negócios > Negócio (`/deals/$id`).
**Antes de começar:** Abra um negócio ao qual você tenha acesso.

## Passo a passo
1. Confira as propriedades e as associações do negócio.
2. Para trocar o funil, use o seletor com a indicação "Selecione o funil".
3. Confira a etapa e o substatus após a alteração.
4. Consulte as áreas "Cotações", "Propostas" e "Contratos".
5. Para criar uma cotação, adicione primeiro itens de linha ao negócio. Depois, na área "Cotações", clique em "Adicionar".
6. Para excluir o negócio, use a ação de exclusão apenas se tiver permissão e confirme a solicitação.
<!-- screenshot: detalhe do negócio com seletor de funil e áreas Cotações, Propostas e Contratos -->

## Resultado esperado
O negócio passa a refletir o funil atualizado. Os documentos vinculados podem ser consultados no mesmo detalhe.

## Regras e limites
- A criação de cotação fica desabilitada quando o negócio não tem itens de linha.
- O acesso ao negócio não concede automaticamente permissão para excluir.
- Alterações e exclusões respeitam as permissões do registro, também no servidor e no banco.

## Erros comuns
- "Não foi possível carregar este negócio.": tente abrir o registro novamente.
- "Negócio não encontrado.": confira o endereço e seu acesso.
- "Você não tem permissão para excluir este negócio.": solicite a ação a uma pessoa autorizada.
- "Adicione itens de linha ao negócio para gerar uma cotação.": cadastre os itens antes de clicar em "Adicionar".

## Relacionados
- [Acompanhar negócios](/ajuda/crm/acompanhar-negocios)
- [Gerenciar cotações e gerar propostas](/ajuda/crm/gerenciar-cotacoes)
