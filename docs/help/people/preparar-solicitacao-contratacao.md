---
module_key: people
slug: preparar-solicitacao-contratacao
title: Preparar solicitação de contratação
summary: Prepare contratação de profissional sem iniciar recrutamento ou admissão.
article_type: howto
route_pattern: /people/hiring-requests
min_permission: techpeople.hiring_requests.view.workspace
audience: internal
sort_order: 35
version: 1
is_published: true
---
# Preparar solicitação de contratação
**Para que serve:** Registrar a preparação de contratação de profissional CLT, PJ ou freelance.
**Quem pode fazer:** Membro ativo com `techpeople.hiring_requests.view.workspace`; criar exige `create.workspace`, editar exige `update.workspace` e cancelar exige `techpeople.hiring_requests.cancel.update.workspace`. As permissões não são concedidas automaticamente aos cargos.
**Onde fica:** TechPeople > Pessoas > Solicitações de contratação (`/people/hiring-requests`).
**Antes de começar:** Tenha acesso aos cadastros reais de área e entidade legal WK. Vínculos opcionais exigem acesso ao cadastro de origem.

## Passo a passo
1. Clique em **Nova solicitação** e informe título e justificativa/escopo.
2. Escolha finalidade **Cliente**, **Interno** ou **Gestão compartilhada**, área responsável e entidade legal WK.
3. Escolha regime **CLT**, **PJ** ou **Freelance**. Se necessário, vincule pessoa real e, no regime PJ, empresa canônica.
4. Associe projeto opcional; negócio e contrato comercial só estão disponíveis para finalidade cliente. Não crie vaga, candidato ou negócio fictício.
5. Clique em **Criar rascunho**. Abra a solicitação salva para editar ou marcar **Pronta para aprovação**.
6. Consulte o histórico por revisão. Para cancelar, use a ação própria e confirme; ela usa os dados salvos, sem incluir alterações ainda não salvas.

## Resultado esperado
Solicitação em rascunho, pronta para aprovação ou cancelada, com histórico imutável. Cada edição válida incrementa a revisão.

## Regras e limites
- Pronta para aprovação **não é aprovação** e não autoriza recrutamento antes da assinatura.
- Não gera vaga, admissão, contrato, assinatura, acesso, lançamento financeiro ou mensagem.
- Não configura aprovadores. Área Técnica sem aprovador permanece sem aprovador.
- Cliente com entidade legal divergente da origem é bloqueado.
- Não há campos de salário ou orçamento. A solicitação não libera dados sensíveis das entidades vinculadas.
- A lista mostra 50 solicitações por página. Seletores consultam até 25 opções por busca e respeitam as permissões do cadastro.
- Cancelada não pode ser editada. Cancelamento não apaga histórico nem altera outros registros.

## Erros comuns
- **Acesso não autorizado:** solicite a permissão específica ao administrador.
- **Entidade legal diverge da origem cliente:** confira a entidade WK no negócio/projeto/contrato antes de vincular.
- **Outra pessoa alterou a solicitação:** recarregue e revise o conteúdo atual antes de salvar. Não há sobrescrita silenciosa.
- **Nenhuma opção disponível:** revise a busca ou permissões do cadastro. Ausência não significa inexistência.

## Relacionados
- [Contratação de fornecedores](/ajuda/contracts/preparar-contratacao-fornecedor)
