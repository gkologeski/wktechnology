---
module_key: people
slug: acompanhar-documentos
title: Acompanhar documentos a vencer
summary: Monitorar documentos com validade nos próximos 60 dias ou vencidos.
article_type: howto
route_pattern: /people/documents
min_permission: techpeople.documents.view.own
audience: internal
sort_order: 30
version: 1
is_published: true
---
# Acompanhar documentos a vencer
**Para que serve:** Ver certidões, contratos e documentos que vencem em até 60 dias ou já venceram.
**Quem pode fazer:** Quem tem `techpeople.documents.view` (ou é gestor). Responsável exige `techpeople.documents.update`; excluir, `techpeople.documents.delete`.
**Onde fica:** Menu > TechPeople > Pessoas > Documentos a vencer (`/people/documents`).
**Antes de começar:** O documento precisa ter validade preenchida na ficha da pessoa.

## Passo a passo
1. Escolha a aba "Todos", "A vencer" ou "Vencidos".
2. Clique no nome da pessoa para abrir a ficha.
3. Para ver o arquivo, clique no ícone "Baixar". Ele abre em nova aba.
4. Para ações em massa, marque as linhas e use "Exportar selecionados", "Responsável" ou "Excluir".
<!-- screenshot: documentos a vencer -->

## Resultado esperado
O arquivo abre em nova aba ou a ação em massa confirma o total.

## Regras e limites
- A lista traz até 200 documentos, do mais próximo de vencer ao mais distante.
- Pessoas arquivadas não aparecem.
- O status "A vencer" é marcado com 30 dias; por isso um documento da lista pode aparecer como "Válido".
- O link do arquivo vale 5 minutos.
- Excluir pede que você digite a quantidade de registros.

## Erros comuns
- "Documento sem arquivo": não há anexo.
- "Registro indisponível ou sem permissão para esta ação.": você não pode ver esse documento.

## Relacionados
- [Usar a ficha da pessoa](/ajuda/people/usar-ficha-pessoa)
