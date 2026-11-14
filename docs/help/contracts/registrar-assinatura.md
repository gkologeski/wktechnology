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
version: 3
is_published: true
---
# Preparar e registrar evidência de assinatura no contrato
**Para que serve:** Preparar e registrar evidência de assinatura no contrato.
**Quem pode fazer:** techcontracts.signature_evidence.view.workspace para ler; manage.workspace e capacidade do servidor para gerenciar; preparação exige também criação de esign.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Salvar a versão final do contrato e revisar suas partes e condições.

## Passo a passo
1. Abra a aba **Aprovações e assinatura** da ficha do contrato e o quadro **Assinaturas do contrato**. A mesma operação está na jornada aberta pelo quadro **Contratação**, na lateral direita do negócio.
2. Para assinatura interna, clique em "Preparar assinatura no TechERP" e preencha representantes/e-mails do cliente e da entidade WK.
3. Conclua a preparação, confira os nomes/e-mails e escolha **Enviar para assinatura por e-mail**. Revise os destinatários no diálogo e confirme. Acompanhe o status de cada signatário no mesmo quadro; reenvios alcançam apenas os pendentes e respeitam intervalo de 60 segundos.
4. Para assinatura externa, clique em "Registrar assinatura externa".
5. Informe "PDF assinado (até 5 MB)", "Data da assinatura", "Referência do provedor ou certificado" e "Como foi conferido". Faça a confirmação explícita antes de concluir.
![Tela: Preparar e registrar evidência de assinatura no contrato, sem dados pessoais reais](/help-media/contracts/registrar-assinatura.webp)

## Resultado esperado
Documento preparado aguardando envio/conclusão, ou evidência externa registrada para a versão conferida.

## Regras e limites
- As ações usam a versão salva do contrato.
- Preparar não é enviar nem concluir assinatura. O envio exige leitura do documento, leitura da evidência e `techcontracts.esign_send.manage.workspace`. O aceite do convite pelo serviço de e-mail não comprova entrega na caixa postal. Falhas e supressões aparecem separadamente.
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
