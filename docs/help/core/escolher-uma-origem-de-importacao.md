---
module_key: core
slug: escolher-uma-origem-de-importacao
title: Escolher uma origem de importação
summary: Escolher uma origem de importação.
article_type: howto
route_pattern: /settings/import
min_permission: system.import.view.workspace
audience: internal
sort_order: 129
version: 2
is_published: true
---
# Escolher uma origem de importação

**Para que serve:** Escolher uma origem de importação, no contexto da tela `/settings/import`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.import`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/import`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Importar dados.
2. Consulte as origens disponíveis no hub.
3. Escolha a origem e siga o fluxo específico exibido.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso system.import. Importações específicas podem exigir permissões adicionais de entidade e integração; o hub não é autorização universal para gravar nos seis módulos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/import com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/escolher-uma-origem-de-importacao.webp)
