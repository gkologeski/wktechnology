---
module_key: contracts
slug: registrar-origem-comercial
title: Salvar origem comercial e definir origem do recrutamento
summary: Salvar origem comercial e definir origem do recrutamento no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id
min_permission:
audience: internal
sort_order: 36
version: 1
is_published: true
---
# Salvar origem comercial e definir origem do recrutamento
**Para que serve:** Salvar origem comercial e definir origem do recrutamento.
**Quem pode fazer:** Leitura e gerenciamento de techcontracts.signature_evidence, com capacidade de gerenciamento devolvida pelo servidor.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Negócio correto e CNPJ WK disponíveis.

## Passo a passo
1. Abra "Assinatura e origem do recrutamento".
2. Escolha "Negócio" e "Entidade WK prestadora" em "Selecione o CNPJ".
3. Clique em "Salvar origem".
4. Quando adequado, clique em "Definir como origem do recrutamento".
<!-- screenshot: Salvar origem comercial e definir origem do recrutamento, sem dados pessoais reais -->

## Resultado esperado
Origem comercial salva; definição da origem do recrutamento é uma ação separada.

## Regras e limites
- Cliente vem do negócio selecionado.
- Mudar origem ou entidade invalida correspondência com assinaturas anteriores.
- Definir origem não registra assinatura, não aprova a demanda nem libera recrutamento sozinho.
- Ainda são necessárias aprovação da área, CEO e demais regras aplicáveis.

## Erros comuns
"Autorização comercial pendente": leia os impedimentos. Sem negócio ou CNPJ, não é possível salvar origem.

## Relacionados
- [Registrar assinatura](/ajuda/contracts/registrar-assinatura)
