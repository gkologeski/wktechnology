---
module_key: crm
slug: consultar-scoring-de-prospeccao
title: Consultar scoring de prospecção
summary: Consultar scoring de prospecção.
article_type: howto
route_pattern: /settings/scoring
min_permission: 
audience: internal
sort_order: 164
version: 2
is_published: true
---
# Consultar scoring de prospecção

**Para que serve:** Consultar scoring de prospecção, no contexto da tela `/settings/scoring`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.prospecting_scoring`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/scoring`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/scoring.
2. Consulte os controles e as regras de pontuação apresentados.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso techsales.prospecting_scoring. Não é o match-score de candidatos do TechHire.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

![Tela: capturar /settings/scoring com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/crm/consultar-scoring-de-prospeccao.webp)
