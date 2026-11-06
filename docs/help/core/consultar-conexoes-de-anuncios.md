---
module_key: core
slug: consultar-conexoes-de-anuncios
title: Consultar conexões de anúncios
summary: Consultar conexões de anúncios.
article_type: howto
route_pattern: /settings/ads-sync
min_permission: 
audience: internal
sort_order: 110
version: 2
is_published: true
---
# Consultar conexões de anúncios

**Para que serve:** Consultar conexões de anúncios, no contexto da tela `/settings/ads-sync`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/ads-sync`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/ads-sync.
2. Confira Provedor, ID externo e Nome de exibição no formulário Conectar conta.
3. Consulte Contas conectadas e Audiências sincronizadas.
4. Use Remover apenas quando quiser desconectar a conta indicada.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Registrar uma conexão na tela não prova execução de sincronização no provedor; valide o estado apresentado e não prometa atualização automática.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/ads-sync com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/consultar-conexoes-de-anuncios.webp)
