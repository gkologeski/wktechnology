---
module_key: contracts
slug: registrar-assinatura
title: Preparar e registrar evidência de assinatura no contrato
summary: Preparar e registrar evidência de assinatura no contrato no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/$id
min_permission:
audience: internal
sort_order: 37
version: 1
is_published: true
---
# Preparar e registrar evidência de assinatura no contrato
**Para que serve:** Preparar e registrar evidência de assinatura no contrato.
**Quem pode fazer:** techcontracts.signature_evidence.view.workspace para ler; manage.workspace e capacidade do servidor para gerenciar; preparação exige também criação de esign.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Salvar a versão final do contrato e revisar suas partes e condições.

## Passo a passo
1. Abra "Assinatura e origem do recrutamento".
2. Para assinatura interna, clique em "Preparar assinatura no TechERP" e preencha representantes/e-mails do cliente e da entidade WK.
3. Conclua a preparação; siga depois o envio e assinatura do documento preparado.
4. Para assinatura externa, clique em "Registrar assinatura externa".
5. Informe "PDF assinado (até 5 MB)", "Data da assinatura", "Referência do provedor ou certificado" e "Como foi conferido". Faça a confirmação explícita antes de concluir.
<!-- screenshot: Preparar e registrar evidência de assinatura no contrato, sem dados pessoais reais -->

## Resultado esperado
Documento preparado aguardando envio/conclusão, ou evidência externa registrada para a versão conferida.

## Regras e limites
- As ações usam a versão salva do contrato.
- Preparar não é enviar nem concluir assinatura.
- Ativar ou preencher uma data não comprova assinatura.
- Registro externo depende de conferência humana; não valida criptograficamente as assinaturas.
- Alterar conteúdo, partes ou condições exige nova evidência.

## Erros comuns
"Selecione um PDF de até 5 MB.": revise formato/tamanho.
"Sem permissão ou contrato alterado. Recarregue.": recarregue e confira a versão.
"Não foi possível guardar o PDF assinado.": tente novamente após conferir o arquivo.

## Relacionados
- [Consultar e revogar evidências](/ajuda/contracts/revogar-evidencia)
- [Documentos de assinatura](/ajuda/contracts/gerenciar-documentos-assinatura)
