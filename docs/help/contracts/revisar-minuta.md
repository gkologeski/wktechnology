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
version: 6
is_published: true
---
# Revisar e aprovar a minuta de contrato
**Para que serve:** Conferir a minuta padrão do serviço antes de ela seguir para o cliente.
**Quem pode fazer:** Consultar exige "Ver minutas de contrato". Editar, trocar o modelo, aprovar ou recusar exige estar na lista de aprovadores jurídicos e ter "Aprovar minuta de contrato".
**Onde fica:** abra pela notificação "Minuta aguardando revisão" (/contracts/drafts/…).
**Antes de começar:** A proposta precisa ter sido aceita pelo cliente e o workflow "Proposta aceita → Contratação" precisa estar publicado.

## Passo a passo
1. Abra a notificação. A tela mostra o negócio, a situação da minuta e o histórico.
2. Confira a **Empresa prestadora (CNPJ WK)** no topo da revisão. Ela nasce herdada da proposta e pode ser trocada enquanto a minuta estiver em revisão jurídica ou aguardando ajustes (toda troca fica registrada no histórico).
3. Em "Modelo de contrato", mantenha o modelo padrão ou escolha outro e clique em **Preencher dados da proposta** para inserir razão social, CNPJ, endereço, valores e prazos no texto. Se trocar a empresa prestadora, clique novamente em **Preencher dados da proposta** para atualizar o texto antes de aprovar. Quando faltar algum dado obrigatório, o alerta agrupa as pendências por origem (**Empresa prestadora**, **Cliente/signatário** ou **Fornecedor/signatário**, **Proposta comercial** e **Negócio**) com o link **Abrir cadastro** em nova aba para corrigir sem perder edições da minuta; depois basta voltar e clicar novamente em **Preencher dados da proposta**.
4. Ajuste o texto no editor e clique em "Salvar edição" para guardar sem aprovar.
5. Clique em "Aprovar envio" para liberar a minuta. Para não enviar, use "Recusar" e informe o motivo.
6. Com a minuta aprovada, use "Enviar ao cliente por e-mail" (sai da sua conta Gmail conectada) ou "Copiar link para o cliente".
7. O cliente abre o link, informa o nome e clica em "Aceitar minuta" ou "Pedir ajustes". Os aprovadores recebem um aviso com a resposta.

## Resultado esperado
Cada passo fica no histórico. Ao enviar, o negócio vai para "Minuta enviada". Quando o cliente aceita, o negócio vai para "Contrato em elaboração" e o workflow "Criar contrato" é liberado. Se o cliente pedir ajustes, a minuta volta a ser editável para nova aprovação.

## Regras e limites
- Se outra pessoa salvou antes, a tela pede para recarregar: nada é sobrescrito.
- Minuta aprovada ou recusada não pode mais ser editada.
- Trocar a empresa prestadora em minuta já decidida exige abrir uma nova revisão com motivo.
- Só aprovadores jurídicos listados podem enviar a minuta, e somente depois de aprovada.
- O link do cliente só funciona enquanto a minuta está enviada; depois da resposta ele mostra apenas o resultado.
- O workflow "Criar contrato" só inicia depois do aceite da minuta.

## Erros comuns
- "Sem permissão para esta ação": peça ao administrador a permissão indicada em "Quem pode fazer".
- "A minuta foi alterada por outra pessoa": recarregue a tela antes de salvar de novo.
- "Conecte sua conta Gmail": conecte sua conta em Canais de atendimento ou use "Copiar link para o cliente".

## Relacionados
- [Revisar e aprovar a minuta de contrato](/help/contracts/revisar-minuta)
- [Escolher os aprovadores jurídicos da minuta](/help/contracts/configurar-aprovadores-minuta)

## Dispensar o aceite do cliente
Depois da aprovação jurídica, quem tem a permissão **"Dispensar aceite do cliente na minuta"** vê o botão **Dispensar aceite do cliente**. Use quando o cliente já concordou por outro meio.
1. Clique em **Dispensar aceite do cliente**.
2. Escreva o motivo (mínimo de 10 caracteres) e confirme.

A minuta passa a contar como aceita, o negócio vai para "Contrato em elaboração" e o histórico registra quem dispensou, quando e por quê. A aprovação jurídica não pode ser dispensada. A permissão não é dada automaticamente a nenhum cargo: o administrador libera em Configurações › Permissões.

## Acompanhar pela central de notificações

Em **Central de notificações > Regras**, um membro com permissão de Workflows pode configurar **Minuta aceita**, usando o negócio vinculado como origem do Workflow. Esse evento exige a resposta real do cliente à minuta enviada; a dispensa administrativa de aceite não o emite. A seleção abre um rascunho desativado; não publica a regra, não envia avisos nem substitui o fluxo jurídico. Revise os destinatários e as regras existentes para evitar configurar avisos adicionais com o mesmo objetivo.

Os avisos e encaminhamentos que já pertencem à revisão jurídica permanecem com suas regras. Um aviso da central não aprova a minuta, não dispensa aceite, não cria outro contrato e não conclui a tarefa vinculada. O destinatário precisa continuar ativo no workspace e ter acesso atual à origem; abrir a minuta conserva suas permissões próprias.

Consulte [Usar a central de notificações](/ajuda/core/usar-central-de-notificacoes) para preferências por evento, canais e histórico de entregas.
