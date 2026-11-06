---
module_key: crm
slug: manter-modelos-de-cotacao
title: Manter modelos de cotação
summary: Manter modelos de cotação.
article_type: howto
route_pattern: /settings/quote-templates
min_permission: 
audience: internal
sort_order: 159
version: 2
is_published: true
---
# Manter modelos de cotação

**Para que serve:** Manter modelos de cotação, no contexto da tela `/settings/quote-templates`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `techsales.quote_templates`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/quote-templates`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/quote-templates.
2. Abra o modelo no editor apresentado.
3. Revise o conteúdo e avalie Converter para editor visual quando a ação estiver disponível.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Modelos de cotação não são modelos de proposta nem de contrato; a conversão de editor exige revisão do resultado.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `crm`; consulte os artigos desse módulo em `/ajuda/crm`.

![Tela: capturar /settings/quote-templates com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/crm/manter-modelos-de-cotacao.webp)
