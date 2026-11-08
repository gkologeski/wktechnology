---
module_key: contracts
slug: revisar-minuta
title: Revisar e aprovar a minuta de contrato
summary: Como o aprovador jurídico confere, troca o modelo, edita e aprova ou recusa a minuta gerada após o aceite da proposta.
article_type: howto
route_pattern: /contracts/drafts/$id
min_permission: techcontracts.contract_drafts.view.workspace
audience: internal
sort_order: 40
version: 1
is_published: true
---
# Revisar e aprovar a minuta de contrato
**Para que serve:** Conferir a minuta padrão do serviço antes de ela seguir para o cliente.
**Quem pode fazer:** Consultar exige "Ver minutas de contrato". Editar, trocar o modelo, aprovar ou recusar exige estar na lista de aprovadores jurídicos e ter "Aprovar minuta de contrato".
**Onde fica:** abra pela notificação "Minuta aguardando revisão" (/contracts/drafts/…).
**Antes de começar:** A proposta precisa ter sido aceita pelo cliente e o workflow "Proposta aceita → Contratação" precisa estar publicado.

## Passo a passo
1. Abra a notificação. A tela mostra o negócio, a situação da minuta e o histórico.
2. Em "Modelo de contrato", mantenha o modelo padrão ou escolha outro. Trocar o modelo substitui o texto.
3. Ajuste o texto no editor e clique em "Salvar edição" para guardar sem aprovar.
4. Clique em "Aprovar envio" para liberar a minuta. Para não enviar, use "Recusar" e informe o motivo.

## Resultado esperado
A alteração fica registrada e vale para as próximas minutas.

## Regras e limites
- Se outra pessoa salvou antes, a tela pede para recarregar: nada é sobrescrito.
- Minuta aprovada ou recusada não pode mais ser editada.
- Aprovar não envia e-mail ao cliente nesta versão; o envio e o aceite da minuta pelo cliente são a próxima etapa.
- O workflow "Criar contrato" só deve iniciar depois do aceite da minuta.

## Erros comuns
- "Sem permissão para esta ação": peça ao administrador a permissão indicada em "Quem pode fazer".
- "A minuta foi alterada por outra pessoa": recarregue a tela antes de salvar de novo.

## Relacionados
- [Revisar e aprovar a minuta de contrato](/help/contracts/revisar-minuta)
- [Escolher os aprovadores jurídicos da minuta](/help/contracts/configurar-aprovadores-minuta)
