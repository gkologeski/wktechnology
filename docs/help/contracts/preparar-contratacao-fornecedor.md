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
version: 1
is_published: true
---
# Preparar contratação de fornecedor
**Para que serve:** Preparar contratação de empresa responsável por serviço ou resultado, com WK compradora.
**Quem pode fazer:** Membro ativo com `techcontracts.supplier_requests.view.workspace`; criar exige `create.workspace`, editar exige `update.workspace` e cancelar exige `techcontracts.supplier_requests.cancel.update.workspace`. Não há concessão automática a cargos.
**Onde fica:** TechContracts > Contratos > Contratação de fornecedores (`/contracts/supplier-requests`).
**Antes de começar:** Cadastros canônicos de empresa, área responsável e entidade legal WK, visíveis ao seu usuário.

## Passo a passo
1. Clique em **Nova solicitação** e preencha título e justificativa/escopo do serviço ou resultado.
2. Escolha finalidade, área responsável e entidade legal WK.
3. Escolha a empresa fornecedora. Se necessário, associe um contato pertencente a essa empresa.
4. Vincule projeto opcional; negócio e contrato comercial só se a finalidade for cliente e o vínculo fizer sentido.
5. Salve como **Criar rascunho**. Reabra para editar ou marcar **Pronta para aprovação**.
6. Consulte o histórico; **Cancelar solicitação** exige confirmação e não inclui alterações ainda não salvas.

## Resultado esperado
Preparação de compra WK versionada, sem contrato ou processo operacional criado.

## Regras e limites
- Não é contratação de profissional: não há regime CLT/PJ/freelance nem vínculo de pessoa nesta entrada.
- Pronta exige escopo, área, entidade legal e empresa fornecedora. Não significa aprovada.
- WK compradora continua sendo `client`; WK fornecedora no fluxo comercial continua sendo `provider`. Esta preparação não modifica contratos comerciais existentes.
- Contrato comercial opcional representa a origem cliente com WK fornecedora, não o futuro contrato de compra.
- Entidade legal divergente da origem cliente é bloqueada.
- Preparação não autoriza recrutamento antes da assinatura e não configura aprovadores.
- Não cria aprovação, vaga, admissão, contrato, assinatura, acesso, financeiro ou mensagens.
- Não há orçamento ou salário; vínculos não concedem leitura de campos sensíveis.
- Lista de 50 por página, buscas de até 25 opções com acesso do usuário. Cancelada é terminal e preserva histórico.

## Erros comuns
- **Contato não pertence ao fornecedor:** escolha um contato da empresa selecionada.
- **Outra pessoa alterou:** recarregue e revise a versão salva antes de editar.
- **Sem permissão / nenhuma opção:** confira a permissão da solicitação e do cadastro vinculado.

## Relacionados
- [Solicitação de profissionais](/ajuda/people/preparar-solicitacao-contratacao)
