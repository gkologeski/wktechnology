# Workflow: abrir criação de oportunidade quando o Lead vira "Oportunidade"

## Objetivo

Quando o estágio do Lead mudar para **Oportunidade** (etapa `oportunity` do "Funil de Leads"), o sistema deve abrir automaticamente, na tela do lead, o modal de criação de negócio já preenchido com:

- pipeline **Novos Negócios** (pipeline padrão de negócios);
- **data de previsão de fechamento** = último dia útil do mês corrente (seg–sex, sem feriados);
- **empresa** vinculada do lead;
- **contato principal** vinculado do lead.

O usuário confere/ajusta os demais campos e confirma. Nada é criado sem confirmação.

## Como vai funcionar

1. O workflow (entidade Leads, evento "etapa alterada", condição `stage_id changed_to oportunity`) executa uma nova ação: **"Abrir criação de oportunidade"**.
2. Essa ação registra uma intenção pendente vinculada ao lead (uma atividade marcadora, no mesmo padrão já usado hoje pela ação "Criar pesquisa").
3. A tela de detalhe do lead, depois de salvar a etapa, já dispara o processamento imediato dos workflows e faz um curto polling — o mesmo mecanismo do modal de qualificação. Ao encontrar a intenção pendente, abre o modal de criação de negócio com os valores pré-preenchidos.
4. Ao criar o negócio (ou ao descartar), a intenção é concluída para não reabrir.

## Escopo das alterações

Fluxo do workflow (motor + builder):

- Nova ação `open_deal_dialog` ("Abrir criação de oportunidade") em `src/lib/workflows/types.ts`, `schemas.ts` e no motor `engine.server.ts`, com campos opcionais: pipeline de destino, estágio inicial e regra da data de previsão (padrão: último dia útil do mês).
- Exibição/edição da nova ação no builder: `src/components/workflows/builder/step-tree.ts` e `step-config-panel.tsx`.

Tela do lead:

- `src/routes/_authenticated/leads.$id.tsx`: além da pesquisa pendente, buscar a intenção pendente de oportunidade e abrir `CreateDealFromLeadDialog` com os defaults; concluir a intenção após criar/fechar.
- `src/components/leads/create-deal-from-lead-dialog.tsx`: aceitar props opcionais de pré-preenchimento (`pipelineId`, `stageValue`, `expectedClose`, `companyId`/`contactId`) sem alterar o comportamento atual quando abertas manualmente. Priorizar `leads.company_id` e `leads.converted_contact_id` na vinculação, com o fallback atual por e-mail/telefone.

Utilitário:

- `lastBusinessDayOfMonth()` em um util de datas (novo arquivo pequeno em `src/lib/`), com teste unitário.

Dados:

- Migration inserindo o registro do workflow "Lead → Oportunidade" ativo para o workspace, apontando para o pipeline **Novos Negócios**. O workflow fica visível e editável em Workflows como qualquer outro.

## Detalhes técnicos

- A intenção pendente reaproveita `activities` com `custom_fields` (`ui_action: "create_deal"`, `pipeline_id`, `stage_value`, `due_rule: "last_business_day_of_month"`), evitando nova tabela e mantendo RLS/permissões atuais.
- Nova server function (padrão `createServerFn` + `requireSupabaseAuth`) para ler e concluir a intenção pendente, análoga a `getPendingSurveyActivity`.
- Nenhuma mudança em RLS, autenticação, schema de negócios ou na criação de negócio em si; a criação continua sendo o fluxo existente do modal.
- Sem criação automática de negócio: a ação apenas abre o modal, como pedido.

## Validação

- `tsgo` (typecheck), lint e build.
- Teste unitário do cálculo do último dia útil.
- Validação manual: mover um lead para "Oportunidade" em `/leads/:id` e confirmar que o modal abre com pipeline Novos Negócios, data prevista correta, empresa e contato preenchidos.
