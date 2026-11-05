---
module_key: platform
slug: tratar-chamados-da-plataforma
title: Tratar chamados da plataforma
summary: Tratar chamados da plataforma.
article_type: howto
route_pattern: /admin/bug-reports
min_permission: 
audience: internal
sort_order: 181
version: 1
is_published: true
---
# Tratar chamados da plataforma

**Para que serve:** Tratar chamados da plataforma, no contexto da tela `/admin/bug-reports`.

**Quem pode fazer:** Somente administrador da plataforma; admin de workspace não basta.

**Onde fica:** Administração da plataforma > `/admin/bug-reports`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Administração da plataforma > Chamados.
2. Consulte os chamados em lista ou quadro.
3. Abra o registro, revise o diagnóstico e use o diálogo de resolução quando apropriado.
4. Revise cuidadosamente qualquer ação em massa ou exclusão.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Exclusivo de admin da plataforma. A análise por IA auxilia a triagem, não comprova correção publicada.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `platform`; consulte os artigos desse módulo em `/ajuda/platform`.

<!-- screenshot: capturar /admin/bug-reports com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
