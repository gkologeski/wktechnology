---
module_key: core
slug: administrar-canais-de-atendimento
title: Administrar canais de atendimento
summary: Administrar canais de atendimento.
article_type: howto
route_pattern: /settings/channels
min_permission: system.channels.view.workspace
audience: internal
sort_order: 117
version: 4
is_published: true
---
# Administrar canais de atendimento

**Para que serve:** Administrar canais de atendimento, no contexto da tela `/settings/channels`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.channels`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/channels`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > Canais de atendimento.
2. Consulte as conexões e contas apresentadas.
3. Use o editor de conta somente se possuir autorização de gerenciamento.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A consulta exige system.channels.view.workspace; gerenciamento usa system.channels.manage.workspace. Não trate estar conectado como garantia de entrega de mensagens.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/channels com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/administrar-canais-de-atendimento.webp)

## Números conectados e arquivados

- A lista principal mostra só os números **conectados**. O contador do cartão de cada canal também conta só os conectados.
- Ao clicar em **Atualizar contas**, um número que foi desconectado (ou que só aparece em conversas antigas) vai para **Arquivados**, no fim da lista.
- Abra **Arquivados** para consultar o histórico: nome, número, data do arquivamento e quantas conversas foram preservadas. Não é possível editar nem ligar um agente a um número arquivado, e ele não envia nem recebe mensagens.
- Se o número voltar a ser conectado, ele sai de Arquivados sozinho na próxima atualização.
- Nada é apagado: conversas e mensagens continuam guardadas.

## LinkedIn pessoal e agentes

Conecte sua conta em Meu LinkedIn e clique em Atualizar contas em Canais. A lista inclui somente sua conta no workspace ativo. Selecione o canal, informe o nome de atendimento, habilite a conta e escolha um agente publicado. Configure separadamente o atendimento receptivo e as respostas após sequências LinkedIn. Salvar um agente não inicia campanhas. O agente utiliza a persona publicada e os mesmos controles de identidade, CRM e atendimento humano dos outros canais.
