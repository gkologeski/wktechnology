---
module_key: crm
slug: abrir-pesquisas-pelas-configuracoes
title: Abrir pesquisas pelas configurações
summary: Abrir pesquisas pelas configurações.
article_type: howto
route_pattern: /settings/surveys
min_permission: 
audience: internal
sort_order: 170
version: 2
is_published: true
---
# Abrir pesquisas pelas configurações

**Para que serve:** Abrir pesquisas pelas configurações, no contexto da tela `/settings/surveys`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.surveys`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/surveys`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/surveys.
2. Consulte a listagem e o editor de pesquisas apresentado.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Renderiza SurveysPage; pertence às pesquisas do TechSales, como /surveys.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

![Tela: capturar /settings/surveys com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/crm/abrir-pesquisas-pelas-configuracoes.webp)
