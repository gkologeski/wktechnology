---
module_key: contracts
slug: verificar-um-documento-pelo-hash
title: Verificar um documento pelo hash
summary: Verificar um documento pelo hash.
article_type: howto
route_pattern: /verify/$hash
min_permission: 
audience: internal
sort_order: 219
version: 1
is_published: true
---
# Verificar um documento pelo hash

**Para que serve:** Verificar um documento pelo hash, no contexto da tela `/verify/$hash`.

**Quem pode fazer:** A página é pública pelo mecanismo próprio (link, token, slug ou conteúdo aberto); este guia é interno e não concede acesso à Ajuda a visitantes.

**Onde fica:** Link público recebido ou página pública > `/verify/$hash`.

**Antes de começar:** Tenha o link original válido; não divulgue parâmetros sensíveis.

## Passo a passo
1. Abra o link de verificação do documento.
2. Confira o resultado e os dados de verificação apresentados.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Verificação não assina o documento nem permite alterar seu conteúdo.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `contracts`; consulte os artigos desse módulo em `/ajuda/contracts`.

<!-- screenshot: capturar /verify/$hash com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
