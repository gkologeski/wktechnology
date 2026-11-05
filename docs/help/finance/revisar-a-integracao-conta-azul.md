---
module_key: finance
slug: revisar-a-integracao-conta-azul
title: Revisar a integração Conta Azul
summary: Revisar a integração Conta Azul.
article_type: howto
route_pattern: /settings/integrations/contaazul
min_permission: 
audience: internal
sort_order: 134
version: 1
is_published: true
---
# Revisar a integração Conta Azul

**Para que serve:** Revisar a integração Conta Azul, no contexto da tela `/settings/integrations/contaazul`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. O gate de rota referencia `system.integrations`.

**Onde fica:** Configurações ou navegação do workspace > `/settings/integrations/contaazul`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra Integrações > Conta Azul.
2. Revise a conexão e o fluxo de importação apresentado.
3. Confira o planejamento e as conciliações antes de aplicar a importação.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
Integração do TechFinance: registros existentes recebem vínculos; correspondências ambíguas vão para revisão. Pagamento deriva de financial_payments, não de escrita direta em paid_amount.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)
- Módulo responsável: `finance`; consulte os artigos desse módulo em `/ajuda/finance`.

<!-- screenshot: capturar /settings/integrations/contaazul com dados fictícios, ocultando tokens, segredos e dados pessoais. -->
