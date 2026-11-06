---
module_key: core
slug: consultar-orientacoes-de-sso
title: Consultar orientações de SSO
summary: Consultar orientações de SSO.
article_type: howto
route_pattern: /settings/sso
min_permission: 
audience: internal
sort_order: 168
version: 2
is_published: true
---
# Consultar orientações de SSO

**Para que serve:** Consultar orientações de SSO, no contexto da tela `/settings/sso`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/sso`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/sso.
2. Leia as orientações de SAML 2.0 e OIDC.
3. Encaminhe a configuração ao administrador responsável pelo provedor de identidade e pelo ambiente Lovable Cloud.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A tela é informativa: não contém formulário de cadastro de IdP. Os badges de JIT e grupos não demonstram configuração ativa; outros IdPs OIDC genéricos não possuem fluxo próprio nesta tela.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/sso com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/consultar-orientacoes-de-sso.webp)
