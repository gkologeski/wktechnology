---
module_key: crm
slug: abrir-o-editor-de-formularios-pelas-configuracoes
title: Abrir o editor de formulários pelas configurações
summary: Abrir o editor de formulários pelas configurações.
article_type: howto
route_pattern: /settings/forms
min_permission: 
audience: internal
sort_order: 126
version: 1
is_published: true
---
# Abrir o editor de formulários pelas configurações

**Para que serve:** Abrir o editor de formulários pelas configurações, no contexto da tela `/settings/forms`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.marketing.forms`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/forms`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/forms.
2. Use a listagem e o editor de formulários apresentados.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A rota renderiza FormsPage, como /forms; pertence ao marketing do TechSales. Não é configuração global de todos os módulos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

<!-- screenshot: capturar /settings/forms com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
