---
module_key: contracts
slug: configurar-cobranca
title: Configurar e versionar o modelo de cobrança
summary: Configurar e versionar o modelo de cobrança no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id/medicoes
min_permission:
audience: internal
sort_order: 71
version: 1
is_published: true
---
# Configurar e versionar o modelo de cobrança
**Para que serve:** Configurar e versionar o modelo de cobrança.
**Quem pode fazer:** techprojects.billing_config.manage.workspace e acesso ao contrato/serviço.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Conferir o escopo e os títulos legados já existentes.

## Passo a passo
1. Em "Modelo de cobrança", escolha "Escopo": "Contrato inteiro" ou um serviço.
2. Escolha "Modelo": por hora, mensalidade/preço fixo, pacote/franquia, marcos/entregáveis ou percentual/sucesso.
3. Informe "Vale a partir de" e "Arredondamento (2 casas)".
4. Revise as opções do modelo: horas fechadas, aceite do cliente, franquia, valores, saldo, pró-rata ou percentual, conforme disponibilizado.
5. Preencha "Motivo (mín. 10 caracteres)".
6. Clique em "Ativar modelo" e confirme "Ativar".
<!-- screenshot: Configurar e versionar o modelo de cobrança, sem dados pessoais reais -->

## Resultado esperado
Modelo versionado e ativo a partir da competência escolhida; sem criação de medição ou título.

## Regras e limites
- A interface não oferece competência anterior ao mês atual.
- No escopo de serviço, Medições assume a cobrança a partir da competência; o gerador antigo deixa de faturar esse serviço.
- Títulos legados permanecem e precisam de vínculo ou resolução; não desaparecem com a mudança.
- Configurar modelo não concede permissão de geração financeira.

## Erros comuns
Se houver títulos legados ou pendências, resolva-os no fluxo correto antes de gerar uma nova cobrança.

## Relacionados
- [Preparar medição](/ajuda/contracts/preparar-medicao)
- [Permissões](/ajuda/contracts/permissoes)
