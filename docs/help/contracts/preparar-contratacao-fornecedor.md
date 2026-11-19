---
module_key: contracts
slug: preparar-contratacao-fornecedor
title: Preparar contratação de fornecedor
summary: Prepare compra WK de serviço ou resultado com empresa fornecedora real.
article_type: howto
route_pattern: /contracts/supplier-requests
min_permission: techcontracts.supplier_requests.view.workspace
audience: internal
sort_order: 36
version: 4
is_published: true
---
# Preparar contratação de fornecedor
**Para que serve:** Preparar contratação de empresa responsável por serviço ou resultado, com WK compradora.
**Quem pode fazer:** Membro ativo com `techcontracts.supplier_requests.view.workspace`; criar exige `create.workspace`, editar exige `update.workspace` e cancelar exige `techcontracts.supplier_requests.cancel.update.workspace`. Não há concessão automática a cargos.
**Onde fica:** TechContracts > Contratos > Contratação de fornecedores (`/contracts/supplier-requests`).
**Antes de começar:** Cadastros canônicos de empresa, área responsável e entidade legal WK, visíveis ao seu usuário.

## Passo a passo
1. Abra **Nova solicitação** e percorra **Demanda → Vínculos → Condições → Revisão**. Voltar preserva os dados ainda não salvos.
2. Em **Demanda**, informe título, finalidade Cliente/Interno/Gestão compartilhada, área responsável, entidade WK e escopo.
3. Em **Vínculos**, escolha empresa fornecedora canônica e contato opcional da mesma empresa. Projeto é opcional; negócio e contrato de origem estão disponíveis quando a finalidade é Cliente.
4. Em **Condições**, selecione Por entrega/Por hora/Mensal/Mista. O valor de referência exige permissões específicas `techcontracts.supplier_requests.reference.view.workspace` para consultar e `.reference.update.workspace` para alterar. Não é retornado na lista ou no histórico comum.
5. Para fornecedor, registre **Aceite WK + NF válida** ou **Aceite WK + NF válida + aceite cliente final**, somente como condição em rascunho para revisão. Não libera pagamentos.
6. Em **Revisão**, confira demanda, vínculos e condições e salve o rascunho. Na ficha, o histórico fica ao centro e resumo/jornada/responsáveis à direita; não há aprovação simulada.
7. Reabra para editar ou marcar Pronta para aprovação; cancelar exige confirmação e preserva histórico. Não inclui alterações ainda não salvas.

## Resultado esperado
Preparação de compra WK versionada, sem contrato ou processo operacional criado.

## Regras e limites
- Não é contratação de profissional: não há regime CLT/PJ/freelance nem vínculo de pessoa nesta entrada.
- Pronta exige escopo, área, entidade legal e empresa fornecedora; Cliente exige também negócio ou contrato comercial de origem. Não significa aprovada.
- A condição que também depende do aceite do cliente final permanece como rascunho para revisão.
- WK compradora continua sendo `client`; WK fornecedora no fluxo comercial continua sendo `provider`. Esta preparação não modifica contratos comerciais existentes.
- Contrato comercial opcional representa a origem cliente com WK fornecedora, não o futuro contrato de compra.
- Entidade legal divergente da origem cliente é bloqueada.
- Preparação não autoriza recrutamento antes da assinatura e não configura aprovadores.
- Não cria aprovação, vaga, admissão, contrato, assinatura, acesso, financeiro ou mensagens.
- Valor de referência protegido; vínculos não concedem leitura de salário ou outros campos sensíveis.
- Lista de 50 por página, buscas de até 25 opções com acesso do usuário. Cancelada é terminal e preserva histórico.

- Durante a consulta do nome de um vínculo, aguarde o indicador de carregamento. Vínculo indisponível exige conferir a permissão do cadastro.

## Erros comuns
- **Contato não pertence ao fornecedor:** escolha um contato da empresa selecionada.
- **Outra pessoa alterou:** recarregue e revise a versão salva antes de editar.
- **Sem permissão / nenhuma opção:** confira a permissão da solicitação e do cadastro vinculado.

## Relacionados
- [Solicitação de profissionais](/ajuda/people/preparar-solicitacao-contratacao)
