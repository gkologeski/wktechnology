---
module_key: core
slug: consultar-a-biblioteca-de-midia
title: Consultar a biblioteca de mídia
summary: Consultar a biblioteca de mídia.
article_type: howto
route_pattern: /settings/media
min_permission: 
audience: internal
sort_order: 142
version: 2
is_published: true
---
# Consultar a biblioteca de mídia

**Para que serve:** Consultar a biblioteca de mídia, no contexto da tela `/settings/media`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.media`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/media`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/media.
2. Consulte os itens da biblioteca.
3. Use remoção apenas no item indicado e quando a ação estiver autorizada.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso system.media. Biblioteca de mídia não é sinônimo de Arquivos ou do bucket privado de fotos de contatos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/media com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/consultar-a-biblioteca-de-midia.webp)
