---
module_key: platform
slug: consultar-e-configurar-alertas-da-plataforma
title: Consultar e configurar alertas da plataforma
summary: Consultar e configurar alertas da plataforma.
article_type: howto
route_pattern: /settings/platform/alerts
min_permission: 
audience: internal
sort_order: 184
version: 2
is_published: true
---
# Consultar e configurar alertas da plataforma

**Para que serve:** Consultar e configurar alertas da plataforma, no contexto da tela `/settings/platform/alerts`.

**Quem pode fazer:** Somente administrador da plataforma; admin de workspace não basta.

**Onde fica:** Administração da plataforma > `/settings/platform/alerts`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Administração da plataforma > Alertas.
2. Consulte alertas e regras disponíveis.
3. Revise os critérios antes de salvar uma regra ou executar uma ação de tratamento.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Exclusivo de admin da plataforma. A existência de regra não garante entrega externa de aviso.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `platform`; consulte os artigos desse módulo em `/ajuda/platform`.

![Tela: capturar /settings/platform/alerts com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/platform/consultar-e-configurar-alertas-da-plataforma.webp)
