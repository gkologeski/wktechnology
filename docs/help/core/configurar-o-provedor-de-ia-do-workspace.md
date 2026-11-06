---
module_key: core
slug: configurar-o-provedor-de-ia-do-workspace
title: Configurar o provedor de IA do workspace
summary: Configurar o provedor de IA do workspace.
article_type: howto
route_pattern: /settings/integrations/ai
min_permission: 
audience: internal
sort_order: 133
version: 2
is_published: true
---
# Configurar o provedor de IA do workspace

**Para que serve:** Configurar o provedor de IA do workspace, no contexto da tela `/settings/integrations/ai`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.ai_settings`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/integrations/ai`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Integrações > Inteligência Artificial.
2. Revise o provedor selecionado e os campos apresentados.
3. Salve as configurações pelo formulário e utilize os controles de validação disponíveis.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso system.ai_settings; o menu agrupa sob Integrações, mas o gate é específico de IA. Chat usa o provedor do workspace, Lovable AI como padrão, sem fallback; segredos ficam cifrados no servidor.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/integrations/ai com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/configurar-o-provedor-de-ia-do-workspace.webp)
