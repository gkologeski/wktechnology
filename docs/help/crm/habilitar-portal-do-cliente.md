---
module_key: crm
slug: habilitar-portal-do-cliente
title: Habilitar o portal do cliente
summary: Ativar o portal por contato e copiar seu link individual.
article_type: howto
route_pattern: /settings/portal
min_permission: system.portal.view.workspace
audience: internal
sort_order: 509
version: 1
is_published: true
---
# Habilitar o portal do cliente
**Para que serve:** Liberar um link individual para o cliente acompanhar e abrir solicitações.
**Quem pode fazer:** Admin/dono ou `system.portal.view.workspace`/`system.portal.update.workspace`. Alterar exige update.
**Onde fica:** Menu > TechSales > Vender > Portal do cliente (`/settings/portal`).
**Antes de começar:** Cadastre o contato.

## Passo a passo
1. Busque em "Buscar contato…".
2. Na coluna "Ativo", ligue o acesso.
3. Em "Link público", clique em "Copiar".
4. Envie o link só ao cliente correspondente.
5. Para trocar o endereço, use "Gerar novo token".
6. Para desabilitar, desligue "Ativo".
<!-- screenshot: contato com acesso ativo e ações do link -->

## Resultado esperado
"Link copiado!". Regerar mostra "Token regenerado.".

## Regras e limites
- Busca por nome e e-mail.
- Comandos de link aparecem com o contato ativo.
- O link é uma credencial de acesso: não divulgue.

## Erros comuns
- "Nenhum contato.": ajuste a busca.
- "Erro.": confira o estado do contato e repita.

## Relacionados
- [Consultar e organizar tickets](/ajuda/crm/consultar-organizar-tickets)
