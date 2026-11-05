---
module_key: contracts
slug: alterar-em-massa
title: Alterar status, responsável e campos em massa
summary: Alterar status, responsável e campos em massa no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts
min_permission:
audience: internal
sort_order: 26
version: 1
is_published: true
---
# Alterar status, responsável e campos em massa
**Para que serve:** Alterar status, responsável e campos em massa.
**Quem pode fazer:** Atualização de cada contrato selecionado; status mantém regras de transição e ativação.
**Onde fica:** TechContracts > Contratos (/contracts).
**Antes de começar:** Conferir todos os contratos selecionados e o impacto da mudança.

## Passo a passo
1. Selecione os contratos na tabela.
2. Para status, escolha "Alterar status"; para atribuição, use "Definir responsável" ou "Sem responsável".
3. Para outros campos, clique em "Editar em massa" e use os campos disponibilizados pelo diálogo.
4. Confira o resumo de sucessos e falhas por contrato.
<!-- screenshot: Alterar status, responsável e campos em massa, sem dados pessoais reais -->

## Resultado esperado
Alterações feitas nos registros autorizados; pode haver resultado parcial.

## Regras e limites
- Seletores de status/responsável aplicam imediatamente, sem confirmação adicional.
- Cada contrato é processado em sequência; falha não interrompe os demais.
- Seleção só é limpa se o executor terminar sem falhas.
- A seleção não concede acesso a campos sensíveis ou a transições proibidas.

## Erros comuns
Resumo pode mostrar até três contratos com erro. Revise as falhas antes de repetir para evitar alterações desnecessárias.

## Relacionados
- [Consultar contratos](/ajuda/contracts/consultar-contratos)
- [Permissões](/ajuda/contracts/permissoes)
