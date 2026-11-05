---
module_key: crm
slug: gerenciar-cotacoes
title: Gerenciar cotações e gerar propostas
summary: Consultar cotações e transformar os dados comerciais em proposta ou contrato.
article_type: howto
route_pattern: /settings/quotes
min_permission:
audience: internal
sort_order: 204
version: 1
is_published: true
---
# Gerenciar cotações e gerar propostas
**Para que serve:** Acompanhar cotações e reaproveitar seus dados para preparar propostas e contratos.
**Quem pode fazer:** Membros ativos com TechSales licenciado e acesso aos registros. Compartilhar exige `techsales.quote_share`; excluir exige exclusão em `techsales.quotes`. Gerar contrato exige `techcontracts.contracts.create.own` ou `techcontracts.contracts.create.workspace`.
**Onde fica:** Menu > TechSales > Cotações (`/settings/quotes`).
**Antes de começar:** Crie uma cotação na área "Cotações" de um negócio com itens de linha.

## Passo a passo
1. Consulte "Total emitidas", "Aceitas" e "Valor aceito".
2. Localize a cotação pelo título ou número e confira status, valor e visualizações.
3. Clique em "Gerar proposta" para abrir o assistente de proposta.
4. Revise "Título *", "Responsável" e "Validade".
5. Confira os itens e ajuste "Valor total da proposta", se necessário.
6. Revise o modelo e o conteúdo nas etapas seguintes. Clique em "Criar proposta".
7. Abra a proposta criada para revisar, solicitar aprovação, compartilhar ou enviar.
8. Para gerar um contrato direto da cotação, use a ação de geração de contrato. A mesma ação existe no detalhe da proposta.
9. Para compartilhar a cotação, use os ícones de abrir ou copiar o link.
10. Para excluir, clique no ícone de lixeira e confirme "Excluir esta cotação?".
<!-- screenshot: cotação na lista com Gerar proposta, geração de contrato e ícones de compartilhamento -->

## Resultado esperado
A proposta reaproveita os vínculos e dados comerciais da cotação. O contrato é criado ou o registro já existente é reutilizado.

## Regras e limites
- O fluxo permite Cotação → Proposta → Contrato e também Cotação → Contrato.
- A proposta reaproveita empresa, contato, negócio, moeda, valor, validade e responsável, salvo ajustes feitos no assistente.
- Se já existir proposta para a cotação, ela é reutilizada. O contrato também evita duplicação para a mesma origem.
- A escolha automática do modelo de contrato considera os serviços do catálogo, priorizando modelos publicados e padrão elegíveis.
- O assistente de proposta não altera os itens da cotação.
- No negócio, o menu "Ações" da cotação oferece "Copiar link" e "Baixar PDF" fora do status de rascunho. A lista geral não tem botão próprio de PDF.
- Status: "Rascunho", "Publicada", "Enviada", "Aceita", "Recusada" e "Expirada".
- "Valor aceito" soma as cotações aceitas e é exibido em BRL; confira a moeda de cada cotação.

## Erros comuns
- "Nenhuma cotação. Crie a partir da aba "Cotações" em um negócio.": abra o negócio e crie a cotação.
- "Cotação não encontrada": confira a origem e seu acesso.
- "Proposta não encontrada": confira a proposta usada como origem do contrato.
- "Informe o título.": preencha o título no assistente.
- "Não foi possível carregar os dados.": clique em "Tentar novamente".

## Relacionados
- [Atualizar um negócio](/ajuda/crm/atualizar-negocio)
- [Editar e enviar uma proposta](/ajuda/crm/editar-enviar-proposta)
