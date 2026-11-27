---
module_key: contracts
slug: decidir-aprovacao
title: Aprovar ou rejeitar uma etapa de contrato
summary: Confira o responsável e a ordem das etapas; aprove, rejeite ou assuma uma aprovação pendente com autorização específica e justificativa.
article_type: howto
route_pattern: /contracts/$id
min_permission:
audience: internal
sort_order: 33
version: 3
is_published: true
---
# Aprovar ou rejeitar uma etapa de contrato
**Para que serve:** Aprovar ou rejeitar uma etapa de contrato.
**Quem pode fazer:** Aprovação de techcontracts.approvals, com acesso à etapa e respeito ao responsável atribuído. Assumir uma etapa atribuída a outra pessoa exige também `techcontracts.approval_substitution.manage.workspace`, gestão e aprovação de etapas, leitura e atualização do contrato, membro ativo e workspace correspondente.
**Onde fica:** TechContracts > Contratos (/contracts/$id).
**Antes de começar:** Etapa pendente; anteriores concluídas; contrato em revisão.

## Passo a passo
1. Abra o painel de aprovações.
2. Confira a etapa atual e sua atribuição.
3. Se a etapa estiver atribuída a outra pessoa e você tiver a autorização específica, use **Assumir aprovação**, confira a atribuição e informe a justificativa. A ação atribui a etapa a você e registra a substituição no histórico.
4. Confira que as etapas anteriores foram aprovadas. Registre o comentário, obrigatório em rejeição.
5. Clique em **Aprovar** ou **Rejeitar**. Assumir a etapa não registra uma decisão automaticamente.
6. Confira **Etapa aprovada** ou **Etapa rejeitada**, com a decisão vinculada à sua conta.
![Tela: Aprovar ou rejeitar uma etapa de contrato, sem dados pessoais reais](/help-media/contracts/decidir-aprovacao.webp)

## Resultado esperado
Decisão registrada; rejeição leva a Em negociação e conclusão de todas as aprovações leva a Aguardando assinatura.

## Regras e limites
- Comentário até 2.000 caracteres.
- Não é permitido decidir etapa já decidida ou ainda atribuída a outra pessoa. A substituição autorizada precisa ocorrer antes da decisão.
- **Assumir aprovação** só alcança uma etapa pendente do processo atual, com o contrato em revisão e respeitando a ordem da cadeia. Etapas substituídas por uma nova revisão ou já decididas ficam protegidas.
- A substituição exige justificativa e registra o aprovador anterior, o novo responsável, o ator e a etapa no histórico. Sua decisão é feita pela sua própria conta; o sistema preserva a autoria da pessoa originalmente atribuída.
- Se outra pessoa decidir ou alterar a atribuição enquanto a janela estiver aberta, recarregue e confira a etapa antes de continuar.
- A autorização de substituição é específica e não é concedida automaticamente a todos os cargos. Deny, workspace, membro inativo e sessões somente leitura continuam bloqueando a ação.
- Aprovar não conclui assinatura nem ativa contrato.

## Erros comuns
"Informe o motivo da rejeição", "A etapa foi atribuída a outra pessoa." ou "Conclua a etapa anterior.": corrija a condição antes de decidir.

## Relacionados
- [Iniciar aprovações](/ajuda/contracts/iniciar-aprovacoes)
- [Registrar assinatura](/ajuda/contracts/registrar-assinatura)
- [Aceite comercial e liberação de faturamento](/ajuda/contracts/aceitar-contrato)
