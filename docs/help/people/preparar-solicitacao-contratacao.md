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
version: 3
is_published: true
---
# Preparar solicitação de contratação
**Para que serve:** Registrar a preparação de contratação de profissional CLT, PJ ou freelance.
**Quem pode fazer:** Membro ativo com `techpeople.hiring_requests.view.workspace`; criar exige `create.workspace`, editar exige `update.workspace` e cancelar exige `techpeople.hiring_requests.cancel.update.workspace`. As permissões não são concedidas automaticamente aos cargos.
**Onde fica:** TechPeople > Pessoas > Solicitações de contratação (`/people/hiring-requests`).
**Antes de começar:** Tenha acesso aos cadastros reais de área e entidade legal WK. Vínculos opcionais exigem acesso ao cadastro de origem.

## Passo a passo
1. Abra **Nova solicitação** e percorra **Demanda → Vínculos → Condições → Revisão**. Voltar preserva os dados ainda não salvos.
2. Em **Demanda**, informe título, finalidade Cliente/Interno/Gestão compartilhada, área responsável, entidade WK e escopo. Regime CLT/PJ/Freelance existe somente para profissionais.
3. Em **Vínculos**, escolha Profissional definido (pessoa canônica) ou Necessidade de seleção; esta opção não abre vaga. Empresa PJ pode ser vinculada no regime PJ. Projeto é opcional; negócio e contrato de origem estão disponíveis quando a finalidade é Cliente.
4. Em **Condições**, selecione Por entrega/Por hora/Mensal/Mista. O valor de referência exige permissões específicas `techpeople.hiring_requests.reference.view.workspace` para consultar e `.reference.update.workspace` para alterar. Não é retornado na lista ou no histórico comum.
5. Em **Revisão**, confira demanda, vínculos e condições e salve o rascunho. Na ficha, o histórico fica ao centro e resumo/jornada/responsáveis à direita; não há aprovação simulada.
6. Reabra para editar ou marcar Pronta para aprovação; cancelar exige confirmação e preserva histórico. Não inclui alterações ainda não salvas.

## Resultado esperado
Solicitação em rascunho, pronta para aprovação ou cancelada, com histórico imutável. Cada edição válida incrementa a revisão.

## Regras e limites
- Pronta para aprovação **não é aprovação** e não autoriza recrutamento antes da assinatura.
- Não gera vaga, admissão, contrato, assinatura, acesso, lançamento financeiro ou mensagem.
- Não configura aprovadores. Área Técnica sem aprovador permanece sem aprovador.
- Para marcar Cliente como Pronta para aprovação, associe negócio ou contrato comercial com entidade WK coerente. Rascunhos podem ficar incompletos.
- Valor de referência é separado e protegido; não libera salário, orçamento ou dados sensíveis das entidades vinculadas.
- A lista mostra 50 solicitações por página. Seletores consultam até 25 opções por busca e respeitam as permissões do cadastro.
- Cancelada não pode ser editada. Cancelamento não apaga histórico nem altera outros registros.

## Erros comuns
- **Acesso não autorizado:** solicite a permissão específica ao administrador.
- **Entidade legal diverge da origem cliente:** confira a entidade WK no negócio/projeto/contrato antes de vincular.
- **Outra pessoa alterou a solicitação:** recarregue e revise o conteúdo atual antes de salvar. Não há sobrescrita silenciosa.
- **Nenhuma opção disponível:** revise a busca ou permissões do cadastro. Ausência não significa inexistência.

## Relacionados
- [Contratação de fornecedores](/ajuda/contracts/preparar-contratacao-fornecedor)
