---
module_key: contracts
slug: preparar-medicao
title: Preparar e consultar medições do contrato
summary: Preparar e consultar medições do contrato no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id/medicoes
min_permission:
audience: internal
sort_order: 70
version: 1
is_published: true
---
# Preparar e consultar medições do contrato
**Para que serve:** Preparar e consultar medições do contrato.
**Quem pode fazer:** Leitura do contrato e das seções TechProjects; preparar exige techprojects.measurements.manage.workspace.
**Onde fica:** TechContracts > Contratos (/contracts/$id/medicoes).
**Antes de começar:** Modelo de cobrança ativo e competência definida.

## Passo a passo
1. Na ficha, clique em "Medições".
2. Em "Modelo de cobrança", escolha um modelo ativo.
3. Preencha "Competência" e escolha "Tipo": "Regular" ou "Complemento".
4. Clique em "Preparar medição".
5. Revise o detalhamento aberto após "Rascunho da medição pronto para revisão.".
<!-- screenshot: Preparar e consultar medições do contrato, sem dados pessoais reais -->

## Resultado esperado
Rascunho de medição preparado para revisão, sem emissão ou envio automático ao cliente.

## Regras e limites
- Competência inicial é o mês anterior e o fuso é o do navegador.
- Lista paginada de 20 medições. Abrir a lista não cria medição.
- Etapas são separadas: rascunho, revisão, aprovação, pronta e geração no Financeiro.
- Fechar horas ou obter aceite do cliente não é gerar fatura nem receber pagamento.
- Acesso a contratos não libera automaticamente cobrança, medições, provisões ou rentabilidade.

## Erros comuns
"Configure o modelo primeiro": cadastre um modelo ativo.
"Nenhuma medição": configure cobrança e prepare a competência.

## Relacionados
- [Configurar cobrança](/ajuda/contracts/configurar-cobranca)
- [Revisar medição](/ajuda/contracts/revisar-medicao)
