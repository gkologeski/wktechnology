---
module_key: ats
slug: candidatar-se-a-uma-vaga-publica
title: Candidatar-se a uma vaga pública
summary: Candidatar-se a uma vaga pública.
article_type: howto
route_pattern: /careers/$slug
min_permission: 
audience: internal
sort_order: 194
version: 1
is_published: true
---
# Candidatar-se a uma vaga pública

**Para que serve:** Candidatar-se a uma vaga pública, no contexto da tela `/careers/$slug`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/careers/$slug`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra a vaga publicada.
2. Leia descrição e requisitos.
3. Preencha Nome completo, E-mail e os demais campos solicitados.
4. Envie a candidatura e confira a confirmação.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
O formulário solicita link do currículo PDF; não presuma upload de arquivo. Vaga indisponível não aceita candidatura pela simples troca de slug.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `ats`; consulte os artigos desse módulo em `/ajuda/ats`.

<!-- screenshot: capturar /careers/$slug com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
