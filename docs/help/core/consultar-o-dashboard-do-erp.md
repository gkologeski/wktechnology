---
module_key: core
slug: consultar-o-dashboard-do-erp
title: Consultar o dashboard do ERP
summary: Consultar o dashboard do ERP.
article_type: howto
route_pattern: /home
min_permission: 
audience: internal
sort_order: 104
version: 2
is_published: true
---
# Consultar o dashboard do ERP

**Para que serve:** Consultar o dashboard do ERP, no contexto da tela `/home`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/home`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra o Dashboard do ERP em /home.
2. Ajuste o intervalo de datas.
3. Consulte os indicadores por módulo.
4. Use as opções de exportação somente se estiverem habilitadas.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Exportação usa system.home/export. O painel agrega os módulos reais; não substitui seus dashboards específicos.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /home com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/consultar-o-dashboard-do-erp.webp)
