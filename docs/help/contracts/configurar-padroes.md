---
module_key: contracts
slug: configurar-padroes
title: Configurar padrões de contrato
summary: Configurar padrões de contrato no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /settings/contract-defaults
min_permission:
audience: internal
sort_order: 90
version: 1
is_published: true
---
# Configurar padrões de contrato
**Para que serve:** Configurar padrões de contrato.
**Quem pode fazer:** Leitura de techcontracts.defaults; para salvar, manage de defaults e techcontracts.contracts.update.workspace.
**Onde fica:** TechContracts > Contratos (/settings/contract-defaults).
**Antes de começar:** Acesso à administração dos padrões.

## Passo a passo
1. Abra "Padrões de contrato".
2. Selecione "Todos os tipos" ou a aba do tipo desejado.
3. Preencha os campos disponibilizados.
4. Clique em "Salvar padrões".
<!-- screenshot: Configurar padrões de contrato, sem dados pessoais reais -->

## Resultado esperado
"Padrões salvos." confirma os valores de pré-preenchimento.

## Regras e limites
- Os padrões atuam na criação. Não alteram contratos existentes retroativamente.
- Valores vindos do negócio ou digitados pelo usuário têm prioridade.
- Somente campos marcados para aceitar padrão aparecem.
- Selecionar um provedor de assinatura não configura uma integração com esse provedor.

## Erros comuns
"Não foi possível carregar os padrões de contrato.": use "Tentar novamente". Se salvar for negado, confira as duas permissões necessárias.

## Relacionados
- [Visão geral](/ajuda/contracts/visao-geral)
- [Permissões](/ajuda/contracts/permissoes)
