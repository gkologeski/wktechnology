# Cristiane não consegue qualificar: nenhum questionário visível

## Causa confirmada

O bloqueio anterior (RLS de `leads`) foi resolvido. O erro atual é outro: o modal mostra "Nenhum questionário ativo" porque **os questionários são privados do criador**.

Verificado no banco:

- `prospecting_questionnaires` tem uma única policy de leitura: `SELECT USING (owner_id = auth.uid())`. Não existe coluna de workspace nem regra de compartilhamento.
- Todos os 5 questionários existentes (incluindo o único ativo, "Questionário Padrão") pertencem ao usuário `1c237fbe…` (dono do workspace).
- `prospecting_questions` tem o mesmo padrão owner-only, então as perguntas também não seriam lidas.

Resultado: qualquer usuário que não seja o criador recebe lista vazia e o painel de qualificação fica inutilizável — mesmo sendo admin do workspace e com `techsales.prospecting.questionnaires.view`.

## Correção proposta

### 1. Visibilidade por workspace (migração)

Substituir a policy de leitura owner-only por leitura compartilhada, usando a função `SECURITY DEFINER` já existente `public.shares_workspace_with(uuid)`:

- `prospecting_questionnaires` SELECT: `owner_id = auth.uid() OR is_template = true OR shares_workspace_with(owner_id)`.
- `prospecting_questions` SELECT: mesma regra (via `owner_id` da pergunta, que já espelha o dono do questionário).

Escrita permanece como está (dono, não-template), preservando o comportamento atual; nada é removido além da policy de SELECT substituída.

### 2. Escrita coerente com o RBAC

Para permitir que membros com `questionnaires.update.workspace` editem questionários do workspace, ampliar UPDATE/DELETE para `owner_id = auth.uid() OR (shares_workspace_with(owner_id) AND user_has_permission(...update|delete.workspace))`, mantendo o bloqueio de `is_template = true`. Os handlers em `questionnaires.functions.ts` já chamam `assertAnyPermission`, então o gate server-side continua valendo.

### 3. Mensagem de erro útil na UI

Hoje "Nenhum questionário ativo. Crie um em Prospecção → Questionários" aparece tanto quando não existe questionário quanto quando o usuário não tem acesso — e a maioria dos vendedores não pode criar. Ajustar `qualification-panel.tsx` (e o passo equivalente em `survey-activity-dialog.tsx`) para:

- diferenciar "nenhum questionário ativo" de "sem permissão para ver questionários";
- quando o usuário não tem `questionnaires.create.*`, orientar a pedir ao administrador em vez de sugerir criar.

## Detalhes técnicos

- Migração apenas em policies de `public.prospecting_questionnaires` e `public.prospecting_questions`; sem mudança de schema, sem novos GRANTs (já existentes) e sem tocar em autenticação.
- `shares_workspace_with` é `STABLE SECURITY DEFINER` com `search_path = public`, evitando recursão de RLS em `workspace_members`.
- Nenhuma alteração em `prospecting_qualifications` (a gravação da resposta já funciona pelo `owner_id = auth.uid()`).

## Como validar

1. Logar como cristiane.menezes@, mover um lead para "Qualificado": o "Questionário Padrão" aparece, com as perguntas BANT e pontuação.
2. Salvar a qualificação e recarregar: etapa e respostas persistem, e a atividade "Pesquisa" entra na timeline.
3. Usuário de outro workspace continua sem ver os questionários.
4. Sem `questionnaires.update.workspace`, o botão de editar questionário permanece indisponível.
