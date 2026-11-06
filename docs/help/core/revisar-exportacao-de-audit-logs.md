---
module_key: core
slug: revisar-exportacao-de-audit-logs
title: Revisar exportação de audit logs
summary: Revisar exportação de audit logs.
article_type: howto
route_pattern: /settings/audit-export
min_permission: 
audience: internal
sort_order: 113
version: 2
is_published: true
---
# Revisar exportação de audit logs

**Para que serve:** Revisar exportação de audit logs, no contexto da tela `/settings/audit-export`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.audit_exports`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/audit-export`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/audit-export.
2. Revise as configurações e o estado Ativo.
3. Altere somente os destinos e opções aprovados para exportação de auditoria.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Recurso de rota system.audit_exports. Destinos e credenciais de exportação são sensíveis; a presença da configuração não comprova entrega em um destino externo.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/audit-export com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/revisar-exportacao-de-audit-logs.webp)
