---
module_key: core
slug: consultar-presets-e-cargos-de-contratacao
title: Consultar presets e cargos de contratação
summary: Consultar presets e cargos de contratação.
article_type: howto
route_pattern: /catalog/contracting-presets
min_permission: 
audience: internal
sort_order: 101
version: 2
is_published: true
---
# Consultar presets e cargos de contratação

**Para que serve:** Consultar presets e cargos de contratação, no contexto da tela `/catalog/contracting-presets`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/catalog/contracting-presets`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Cadastros > Presets e Cargos.
2. Selecione Presets de contratação para trabalhar com os presets.
3. Selecione Cargos e funções para consultar o cadastro de perfis.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O cadastro é compartilhado pelos módulos consumidores; o TechHire possui catálogos próprios. Não presuma que mudar um preset reescreva contratações existentes.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /catalog/contracting-presets com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/consultar-presets-e-cargos-de-contratacao.webp)
