---
module_key: crm
slug: revisar-configuracoes-de-reunioes-em-video
title: Revisar configurações de reuniões em vídeo
summary: Revisar configurações de reuniões em vídeo.
article_type: howto
route_pattern: /settings/video
min_permission: 
audience: internal
sort_order: 173
version: 1
is_published: true
---
# Revisar configurações de reuniões em vídeo

**Para que serve:** Revisar configurações de reuniões em vídeo, no contexto da tela `/settings/video`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/video`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/video.
2. Consulte as configurações de reunião.
3. Altere e salve somente se possuir gerenciamento.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Usa techsales.meeting_settings.view.workspace e manage.workspace. Pertence às reuniões do TechSales.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /settings/video com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
