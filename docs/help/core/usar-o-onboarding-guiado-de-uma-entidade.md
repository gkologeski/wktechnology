---
module_key: core
slug: usar-o-onboarding-guiado-de-uma-entidade
title: Usar o onboarding guiado de uma entidade
summary: Usar o onboarding guiado de uma entidade.
article_type: howto
route_pattern: /onboarding/$entity
min_permission: 
audience: internal
sort_order: 107
version: 1
is_published: true
---
# Usar o onboarding guiado de uma entidade

**Para que serve:** Usar o onboarding guiado de uma entidade, no contexto da tela `/onboarding/$entity`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/onboarding/$entity`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra o link de onboarding da entidade desejada.
2. Confira o modelo e as etapas carregadas pelo assistente.
3. Preencha os campos solicitados e avance pelas etapas disponíveis.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O parâmetro $entity identifica a entidade; esta rota genérica não é o onboarding de pessoas do TechPeople. Etapas e tarefas dependem do modelo configurado.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

<!-- screenshot: capturar /onboarding/$entity com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
