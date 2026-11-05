---
module_key: core
slug: permissoes
title: Permissões de Core ERP e Configurações
summary: Permissões de Core ERP e Configurações.
article_type: reference
route_pattern: 
min_permission: 
audience: internal
sort_order: 125
version: 1
is_published: true
---
# Permissões de Core ERP e Configurações

Membro ativo e workspace correto são pré-requisitos. Recursos administrativos usam `system.*`; nem toda rota `/settings` pertence ao Core. Ler não implica criar, atualizar, excluir, exportar ou gerenciar. Deny prevalece.

O menu pode ter alternativas em `permissionAny`, enquanto `help_articles.min_permission` armazena uma única chave. Por isso os rascunhos com alternativas inconciliáveis não recebem chave inventada; precisam de revisão antes da publicação.

Chaves de menu, gate de URL, middleware e RLS devem ser verificados em conjunto.

## Relacionados
- [Visão geral](/ajuda/core/visao-geral)
- [Permissões](/ajuda/core/permissoes)
