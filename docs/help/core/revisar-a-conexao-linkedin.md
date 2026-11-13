---
module_key: core
slug: revisar-a-conexao-linkedin
title: Revisar a conexão LinkedIn
summary: Revisar a conexão LinkedIn.
article_type: howto
route_pattern: /settings/integrations/linkedin
min_permission: system.linkedin.view.workspace
audience: internal
sort_order: 135
version: 4
is_published: true
---
# Revisar a conexão LinkedIn

**Para que serve:** Revisar a conexão LinkedIn, no contexto da tela `/settings/integrations/linkedin`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. Exige leitura de LinkedIn (`system.linkedin.view.own` ou `.workspace`) e, para alterações, gerenciamento correspondente. A conta continua pessoal, mesmo com permissão de workspace.

**Onde fica:** Configurações ou navegação do workspace > `/settings/integrations/linkedin`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Configurações > LinkedIn (Unipile).
2. Confira sua própria conta no workspace ativo; contas de outros usuários não são selecionadas automaticamente.
3. Use Conectar para abrir a autenticação hospedada da Unipile. Nunca informe senha ou cookies no TechERP.
4. Ao retornar, aguarde a confirmação do servidor. O link expira em dez minutos e só pode ser utilizado uma vez; o retorno sozinho não comprova conexão.
5. Revise Fuso horário, Início e Fim. A janela usa o fuso escolhido.
6. Em Proteções da conta LinkedIn, configure limites de mensagens/convites por dia e semana, intervalo mínimo e pausa manual. Salve.
7. Confira Uso de hoje: tentativas reservadas no dia civil do fuso configurado, incluindo chamadas que falharam. Recarregue para atualizar após mudanças.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Conectar, desconectar e alterar a janela exigem leitura e gerenciamento de LinkedIn. O retorno da autenticação não comprova sucesso: a conta só é confirmada após validação segura. Nunca selecione uma conta da listagem global por ser a mais recente.

Os tetos internos conservadores não representam uma franquia oficial garantida. Todas as operações do TechERP compartilham a mesma reserva; ações realizadas fora dele podem não ser contabilizadas. Uma quota zerada bloqueia a ação.

Restrição, indisponibilidade e limite do provedor podem gerar pausa persistente. Erros de credencial ou restrições de acesso exigem verificar a conta na integradora e reconectar. Desmarcar a pausa manual não remove a pausa do provedor. O sistema respeita Retry-After e não troca o remetente para contornar restrições.

Timeout ou resultado incerto de envio fica bloqueado para reconciliação, sem repetição automática. Uma tentativa confirmada devolve seu recibo, sem repetir o envio.

Contas novas usam um escopo pessoal da Unipile. Contas legadas conhecidas reconectam no lugar, sem atribuição permanente automática a outro escopo. Desconectar no TechERP interrompe o uso local; não exclui a conta na Unipile.

Este pacote não adiciona LinkedIn à Inbox comercial, ao Agente SDR ou às sequências de prospecção. Esses recursos dependem dos pacotes seguintes.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/integrations/linkedin com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/revisar-a-conexao-linkedin.webp)
