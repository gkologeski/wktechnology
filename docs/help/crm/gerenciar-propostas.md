---
module_key: crm
slug: gerenciar-propostas
title: Gerenciar propostas
summary: Criar propostas e consultar os registros por responsável, status e valor.
article_type: howto
route_pattern: /proposals
min_permission:
audience: internal
sort_order: 202
version: 4
is_published: true
---
# Gerenciar propostas
**Para que serve:** Cadastrar uma proposta e acompanhar a carteira comercial.
**Quem pode fazer:** Membros ativos com TechSales licenciado. As ações dependem das permissões de `techsales.proposals` e do acesso a cada registro.
**Onde fica:** Menu > TechSales > Propostas (`/proposals`).
**Antes de começar:** Para criar, tenha permissão de criação de propostas.

## Passo a passo
1. Clique em "Nova proposta".
2. Preencha "Título".
3. Se necessário, informe "Valor (BRL)".
4. Clique em "Criar".
5. Na área "Suas propostas", filtre por responsável e pelos campos "Status", "Valor (R$)", "Versão" ou "Empresa".
6. Alterne entre tabela e quadro para acompanhar os registros.
7. Abra uma proposta para editar seu conteúdo e preparar o envio.
8. Para encerrar uma proposta que não vai seguir, abra-a (ou use o menu ⋯ no Negócio) e clique em "Cancelar proposta". Ela fica como Cancelada, o histórico é mantido e o cliente não consegue mais aceitá-la pelo link. Propostas aceitas, recusadas ou expiradas não podem ser canceladas. Exige permissão de alteração de propostas.
9. Para ações em massa, selecione os registros e use apenas as ações liberadas para toda a seleção.
![Tela: Nova proposta com Título e Valor (BRL), seguida da lista com filtros](/help-media/crm/gerenciar-propostas.webp)

## Resultado esperado
A mensagem "Proposta criada" confirma o cadastro. A proposta fica disponível na carteira.

## Regras e limites
- O título é necessário para habilitar "Criar".
- O valor pode ficar sem preenchimento.
- Os status exibidos são "Rascunho", "Em revisão", "Aprovada", "Enviada", "Aceita", "Recusada", "Expirada" e "Cancelada".
- As ações em massa dependem das permissões dos registros selecionados.

## Erros comuns
- Se "Criar" estiver desabilitado, preencha "Título" e aguarde o processamento.
- Se uma ação em massa não estiver disponível, revise a seleção e as permissões.
- Falhas de criação ou exclusão mostram a mensagem devolvida pelo servidor.

## Relacionados
- [Editar e enviar uma proposta](/ajuda/crm/editar-enviar-proposta)
- [Gerenciar cotações e gerar propostas](/ajuda/crm/gerenciar-cotacoes)
