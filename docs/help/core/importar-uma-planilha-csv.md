---
module_key: core
slug: importar-uma-planilha-csv
title: Importar uma planilha CSV
summary: Importar uma planilha CSV.
article_type: howto
route_pattern: /settings/import-csv
min_permission: 
audience: internal
sort_order: 130
version: 2
is_published: true
---
# Importar uma planilha CSV

**Para que serve:** Importar uma planilha CSV, no contexto da tela `/settings/import-csv`.

**Quem pode fazer:** Membro ativo do workspace, com as permissões efetivas da tela e da ação. A tela pode exigir verificações adicionais nas funções e no banco.

**Onde fica:** Configurações ou navegação do workspace > `/settings/import-csv`.

**Antes de começar:** Confirme o workspace e o contexto corretos. Tenha autorização para a operação, e não apenas para consultar a tela.

## Passo a passo
1. Abra /settings/import-csv.
2. Selecione a entidade e o arquivo no assistente.
3. Revise mapeamento e validações antes de confirmar a importação.

## Resultado esperado
A tela apresenta o resultado da consulta ou da ação descrita. Confira a confirmação e o estado exibidos; uma configuração gravada não prova execução no provedor externo.

## Regras e limites
A autorização acompanha a entidade importada. Não inclua uma planilha real, dados pessoais ou credenciais nas capturas da Ajuda.

## Erros comuns
- Se houver acesso negado, confira membership ativo, workspace e permissões da ação; não tente contornar por URL direta.
- Se o link ou registro estiver indisponível, retorne à origem para verificar o contexto; não altere tokens para procurar outros registros.
- Em falha de gravação ou integração, verifique a mensagem antes de repetir. Não compartilhe senha, token ou dados pessoais em chamados.

## Relacionados
- [Visão geral do Core](/ajuda/core/visao-geral)
- [Permissões do Core](/ajuda/core/permissoes)

![Tela: capturar /settings/import-csv com dados fictícios, ocultando tokens, segredos e dados pessoais](/help-media/core/importar-uma-planilha-csv.webp)
