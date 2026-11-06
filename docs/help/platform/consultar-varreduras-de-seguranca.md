---
module_key: platform
slug: consultar-varreduras-de-seguranca
title: Consultar varreduras de segurança
summary: Consultar varreduras de segurança.
article_type: howto
route_pattern: /settings/platform/security
min_permission: 
audience: internal
sort_order: 187
version: 2
is_published: true
---
# Consultar varreduras de segurança

**Para que serve:** Consultar varreduras de segurança, no contexto da tela `/settings/platform/security`.

**Quem pode fazer:** Somente administrador da plataforma; admin de workspace não basta.

**Onde fica:** Administração da plataforma > `/settings/platform/security`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Administração da plataforma > Segurança.
2. Consulte as varreduras e resultados disponíveis.
3. Use a ação habilitada para nova verificação quando necessário.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Exclusivo de admin da plataforma. Um resultado de varredura não certifica ausência de vulnerabilidades ou conformidade integral.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `platform`; consulte os artigos desse módulo em `/ajuda/platform`.

![Tela: capturar /settings/platform/security com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/platform/consultar-varreduras-de-seguranca.webp)
