---
module_key: contracts
slug: configurar-aprovadores-minuta
title: Escolher os aprovadores jurídicos da minuta
summary: Definir quem revisa e aprova a minuta de contrato enviada após o aceite da proposta.
article_type: howto
route_pattern: /contracts/contracting-flow
min_permission: techcontracts.contract_draft_approvers.manage.workspace
audience: internal
sort_order: 41
version: 3
is_published: true
---
# Escolher os aprovadores jurídicos da minuta
**Para que serve:** Indicar quem recebe o aviso "Minuta aguardando revisão".
**Quem pode fazer:** Quem tem "Gerenciar aprovadores de minuta" no cargo.
**Onde fica:** TechContracts > Fluxo de contratação (/contracts/contracting-flow).

**Antes de começar:** Ter os aprovadores definidos com o jurídico.

## Passo a passo
1. Abra a tela e busque o membro pelo nome.
2. Marque até 20 pessoas e clique em "Salvar aprovadores".
3. Confira em Configurações > Permissões se cada uma tem "Ver minutas de contrato" e "Aprovar minuta de contrato".

## Resultado esperado
A alteração fica registrada e vale para as próximas minutas.

## Regras e limites
- Somente membros ativos do workspace podem ser escolhidos.
- Sem aprovador configurado, o responsável do workflow é avisado para configurar.
- Nenhuma permissão é dada automaticamente ao marcar a pessoa.

## Erros comuns
- "Sem permissão para esta ação": peça ao administrador a permissão indicada em "Quem pode fazer".
- "A minuta foi alterada por outra pessoa": recarregue a tela antes de salvar de novo.

## Relacionados
- [Revisar e aprovar a minuta de contrato](/help/contracts/revisar-minuta)
- [Escolher os aprovadores jurídicos da minuta](/help/contracts/configurar-aprovadores-minuta)

## Encaminhamentos automáticos
Com a permissão **Configurar e reprocessar encaminhamentos contratuais**, escolha os responsáveis por Jurídico, Financeiro, assinatura, impedimentos e o operador administrador. Defina os prazos (1 a 30 dias úteis) e o fuso IANA, então salve. Ativar exige pessoas ativas e com os acessos necessários; a seleção não concede permissões.

Proposta aceita gera uma fila para abrir a minuta. Minuta aceita gera tarefa ao Financeiro. Contrato integralmente aprovado gera tarefa de conferir signatários e enviar convites. O processamento ocorre no ciclo periódico de workflows, normalmente em até dois minutos. Dias úteis excluem sábados/domingos, sem calendário de feriados.

As tarefas aparecem em Tarefas e no histórico do negócio. Vencimentos avisam o responsável e o escalonamento uma vez. Impedimentos ficam visíveis no quadro **Próximas ações**; corrija os acessos/configuração e use **Reprocessar etapa**. **Gerar pendências** faz reconciliação explícita somente do negócio aberto (até vinte fontes recentes por etapa), sem varrer nem reescrever históricos.

O envio para assinatura requer conferência de signatários e confirmação humana. A tarefa só conclui após a ação real; marcar a atividade como feita não substitui o aceite, as aprovações ou o envio.

As aprovações internas também geram tarefas: Jurídico primeiro; Financeiro somente após a aprovação jurídica. Cada solicitação usa o responsável da etapa vigente e o prazo configurado do departamento, sem reduzir a cadeia obrigatória.

## Navegação no TechContracts
No seletor de módulos, escolha **TechContracts** e abra **Fluxo de contratação** no menu lateral. A página mantém o menu do módulo e o breadcrumb Contratos > Fluxo de contratação. A seção **Encaminhamentos automáticos** fica abaixo da lista dos aprovadores e exige sua permissão específica. O endereço antigo de Configurações redireciona para esta página; aprovadores, responsáveis, prazos e permissões salvos são preservados.
