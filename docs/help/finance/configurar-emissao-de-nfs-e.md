---
module_key: finance
slug: configurar-emissao-de-nfs-e
title: Configurar emissão de NFS-e
summary: Configurar emissão de NFS-e.
article_type: howto
route_pattern: /settings/nfse
min_permission: 
audience: internal
sort_order: 147
version: 1
is_published: true
---
# Configurar emissão de NFS-e

**Para que serve:** Configurar emissão de NFS-e, no contexto da tela `/settings/nfse`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/nfse`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/nfse.
2. Revise NFE.io, Company ID, inscrição municipal e código de serviço municipal.
3. Confira Emissão automática após pagamento e salve apenas se autorizado.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Consulta exige techfinance.nfse_settings.view.workspace; mudança exige manage.workspace. Campo de emissão automática não garante que o provedor tenha emitido a nota.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `finance`; consulte os artigos desse módulo em `/ajuda/finance`.

<!-- screenshot: capturar /settings/nfse com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
