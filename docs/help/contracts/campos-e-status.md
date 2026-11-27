---
module_key: contracts
slug: campos-e-status
title: Campos e status do TechContracts
summary: Campos e status do TechContracts no TechContracts, com as regras e limites disponíveis no sistema.
article_type: reference
route_pattern: 
min_permission:
audience: internal
sort_order: 2
version: 2
is_published: true
---
# Campos e status do TechContracts
## Contratos
| Campo | Significado operacional |
|---|---|
| Tipo | Prestação ou Compra |
| Tipo de documento | Principal ou Aditivo |
| Contrato principal | Obrigatório no aditivo; não é o mesmo vínculo pai de uma compra |
| Valor total | Valor cadastrado do contrato |
| Início / Fim | Vigência cadastrada |
| Renovação automática | Sim ou Não |
| Aviso prévio (dias) | Prazo cadastrado de aviso |
| Cláusulas / corpo do contrato | Texto ou HTML em campo de texto |

| Status salvo | Label da ficha |
|---|---|
| draft | Rascunho |
| in_review | Em revisão |
| in_negotiation | Em negociação |
| awaiting_signature | Aguardando assinatura |
| active | Ativo |
| renewing | Renovando |
| ended | Encerrado |
| terminated | Rescindido |

Na lista, Aguardando assinatura aparece abreviado como "Aguard. assinatura". Em revisão e Aguardando assinatura passam pelo fluxo de aprovações. Ativo não comprova assinatura.

## Aceite e liberação comercial
O cartão **Aceite do contrato e faturamento** registra a concordância do cliente com a versão atual. O aceite não altera a data nem o estado das assinaturas. Em contratos de prestação, permite ao Financeiro autorizado liberar contas a receber, com os vencimentos acordados. Contratos de compra mantêm as regras de assinatura para contas a pagar.

## Serviços em execução
Tipos: Recorrente, Único, Por marco, Por uso. Status: Pendente, Ativo, Pausado, Cancelado, Concluído. Cadência recorrente: Mensal, Trimestral, Anual. Valor por ciclo = quantidade × preço unitário.

**Concluir execução** registra data e comprovação do trabalho. Um serviço pode estar **Concluído** enquanto a assinatura está pendente e a cobrança continua retida. A jornada do negócio apresenta a execução e a formalização separadamente.

## Documentos e medições
Modelo importado nasce em rascunho. Documento enviado para assinatura sela o conteúdo, sem comprovar entrega de e-mail. Medição tem etapas próprias de revisão, aprovação e geração no Financeiro; provisão não é título financeiro.

## Relacionados
- [Alterar status](/ajuda/contracts/alterar-status)
- [Editar serviço](/ajuda/contracts/editar-servico)
- [Evidência de assinatura](/ajuda/contracts/registrar-assinatura)
- [Aceite comercial do contrato](/ajuda/contracts/aceitar-contrato)
- [Concluir execução](/ajuda/contracts/concluir-execucao-servico)
