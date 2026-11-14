---
module_key: contracts
slug: gerenciar-documentos-assinatura
title: Preparar documentos para assinatura eletrônica
summary: Preparar documentos para assinatura eletrônica no TechContracts, com as regras e limites disponíveis no sistema.
article_type: howto
route_pattern: /contracts/signatures
min_permission:
audience: internal
sort_order: 95
version: 3
is_published: true
---
# Preparar documentos para assinatura eletrônica
**Para que serve:** Preparar documentos para assinatura eletrônica.
**Quem pode fazer:** Permissões de techcontracts.esign conforme a ação: ler, criar, alterar, enviar, cancelar, excluir e gerenciar signatários.
**Onde fica:** TechContracts > Contratos (/contracts/signatures).
**Antes de começar:** Texto revisado e nomes/e-mails dos signatários; compartilhar links apenas com seus destinatários.

## Passo a passo
1. Abra a área de assinatura eletrônica em TechContracts > Assinaturas eletrônicas (/contracts/signatures).
2. Crie um documento com "Título", "Descrição" e "Conteúdo do documento".
3. Informe os signatários, nome, e-mail e ordem. Configure assinatura ordenada quando necessário.
4. Revise o documento e os signatários antes de enviar para assinatura.
5. Para contratos, abra **Assinaturas do contrato** na ficha do contrato ou **Contratação > Abrir jornada e documentos > Contrato** na ficha do negócio. Confira os signatários e confirme **Enviar para assinatura por e-mail**. O histórico diferencia convite aceito pelo serviço de e-mail, supressão e falha. Reenvie somente aos pendentes; os que já assinaram não recebem outro convite.
6. Para documentos avulsos na central, a disponibilização sela o texto e libera os links individuais; a cópia exige permissão de compartilhamento.
![Tela: Preparar documentos para assinatura eletrônica, sem dados pessoais reais](/help-media/contracts/gerenciar-documentos-assinatura.webp)

## Resultado esperado
Documento preparado e, após envio, disponibilizado para assinatura conforme sua validade e ordem.

## Regras e limites
- Título: até 255 caracteres; descrição: até 2.000; corpo: até 50.000.
- De 1 a 20 signatários. Ordem é um inteiro a partir de 1.
- "Documento enviado." indica disponibilização para assinatura e selagem do conteúdo. Não comprova entrega de e-mail.
- Após envio, não é permitido alterar conteúdo/signatários ou excluir. Documento finalizado não pode ser cancelado.
- Provedores selecionáveis em campos de contrato não comprovam integração ativa com DocuSign ou Clicksign.

## Erros comuns
"Documento indisponível para envio.": confira estado, validade e signatários.
"Signatário inválido.": revise nome, e-mail e ordem.

## Relacionados
- [Assinar por link](/ajuda/contracts/assinar-por-link)
- [Registrar evidência no contrato](/ajuda/contracts/registrar-assinatura)
