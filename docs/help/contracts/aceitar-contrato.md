---
module_key: contracts
slug: aceitar-contrato
title: Registrar o aceite do contrato e liberar faturamento
summary: Registre o aceite comercial da versão atual e confira o vencimento antes de liberar contas a receber, mantendo a assinatura separada.
article_type: howto
route_pattern: /contracts/$id
min_permission:
audience: internal
sort_order: 83
version: 1
is_published: true
---
# Registrar o aceite do contrato e liberar faturamento
**Para que serve:** Registrar a concordância comercial do cliente com um contrato de prestação e permitir o faturamento antes da assinatura, quando autorizado.
**Quem pode fazer:** Membro ativo com leitura do contrato e as permissões próprias para compartilhar, registrar aceite e liberar faturamento. O aceite público depende de um link válido da versão apresentada ao cliente.
**Onde fica:** TechContracts > Contratos > ficha > **Aceite do contrato e faturamento** (`/contracts/$id`). O negócio vinculado também permite acompanhar o aceite e a execução.
**Antes de começar:** Confira cliente, texto, valores e condições de pagamento. O aceite deve corresponder ao documento atual; uma proposta aceita ou um pagamento combinado não comprova, sozinho, o aceite do contrato.

## Passo a passo
1. Abra o contrato e confira o cartão **Aceite do contrato e faturamento**.
2. Para obter uma nova resposta, use **Gerar link de aceite** e compartilhe o link pelo canal combinado. O cliente confere o contrato, as condições, os serviços e os anexos disponíveis antes de aceitar. Os anexos são abertos pelo próprio link, sem publicar arquivos privados. Gerar ou copiar o link não envia uma mensagem automaticamente.
3. Se o aceite já foi recebido por outro canal, use **Registrar aceite recebido**, informe quem aceitou, a data e a comprovação. Registre apenas uma manifestação real do cliente sobre essa versão do contrato.
4. Confira o aceite registrado e a situação da assinatura, que continuam separados.
5. O Financeiro autorizado usa **Liberar faturamento**, confere os valores e informa o vencimento combinado quando necessário. A cadeia interna de aprovação precisa existir e estar concluída, com Jurídico e Financeiro aprovados; ausência de aprovadores não dispensa essa revisão. Uma parcela condicionada à assinatura exige uma data de vencimento explícita para ser antecipada pelo aceite.
6. Confira o resultado e os títulos a receber no Financeiro. Continue o acompanhamento das assinaturas no contrato.

## Resultado esperado
O contrato mostra o aceite comercial e sua evidência. A liberação autorizada gera contas a receber uma única vez. A assinatura do cliente continua pendente até que seja efetivamente realizada e conferida.

## Regras e limites
- Aceitar o contrato não registra assinatura, não preenche a data de assinatura e não conclui assinaturas nativas ou ForSign.
- O aceite permite a liberação de faturamento de contratos em que a WK é prestadora. Contratos de compra e contas a pagar mantêm suas exigências próprias de assinatura.
- Concluir a execução, registrar aceite e liberar faturamento são ações distintas. A conclusão da execução não gera cobrança sozinha.
- A liberação cria títulos financeiros; não emite nota fiscal nem envia cobrança automaticamente.
- Permissões são verificadas novamente no servidor e no banco, com workspace e membro ativo. Uma autorização de leitura ou edição não concede, sozinha, liberação financeira.
- A liberação exige `techcontracts.contract_acceptance_billing.manage.workspace`, além das permissões existentes de cobrança e de criação e leitura financeira. Nenhum cargo recebe essa nova permissão automaticamente.
- Substituir o vencimento pelo valor combinado é permitido para uma parcela única. Cronogramas parcelados devem ser conferidos no contrato; parcelas por marco seguem a medição e o aceite da entrega.
- O aceite corresponde à versão apresentada. Alterações relevantes no conteúdo ou nas condições impedem o uso do aceite antigo; obtenha um novo aceite antes de nova liberação. O histórico permanece preservado.
- Link vencido, revogado ou de outra versão não permite uma nova decisão válida.
- Gerar um link exige leitura e atualização do contrato, `techcontracts.contract_acceptance.manage.workspace` e a permissão existente **Compartilhar links de assinaturas eletrônicas — workspace** (`techcontracts.esign_share.manage.workspace`), que representa a autoridade de compartilhar o contrato publicamente. O aceite continua separado da assinatura. Se o emissor perder essa autoridade, o acesso ao contrato ou seu vínculo ativo com o workspace, o link fica indisponível; outra pessoa autorizada deve gerar um novo link.
- Revogar links utiliza a permissão de gerenciar o aceite e o acesso ao contrato. Retirar esse acesso não exige a autoridade adicional de compartilhamento.
- A assinatura posterior não deve duplicar títulos já gerados pelo aceite. Confira e concilie lançamentos existentes antes de qualquer cobrança adicional.
- Revogar o aceite ou o link preserva o histórico e os títulos já gerados. A revogação não cancela cobranças: o Financeiro precisa conferir e conciliar esses lançamentos.
- Não mude o contrato para assinado nem use regularização de legado para substituir um aceite comercial.

## Erros comuns
- **Aceite indisponível ou desatualizado:** confira a versão atual e gere um novo link ou registre a manifestação referente a ela.
- **Sem permissão:** solicite a ação específica e mantenha os perfis restritos; não é necessário conceder administração geral.
- **Vencimento obrigatório:** informe a data acordada com o cliente; não use uma data de assinatura que ainda não existe.
- **Faturamento já liberado:** confira os títulos existentes. Repetir a operação não cria outra cobrança.

## Relacionados
- [Concluir a execução de um serviço](/ajuda/contracts/concluir-execucao-servico)
- [Ativar um serviço](/ajuda/contracts/ativar-servico)
- [Registrar assinatura](/ajuda/contracts/registrar-assinatura)
- [Acompanhar a jornada comercial e contratação](/ajuda/crm/acompanhar-jornada-de-contratacao)
