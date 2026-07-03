
# Conectar módulos via Workflow Builder (Deal → Vaga em rascunho)

## Objetivo
Permitir que ações em um módulo (ex.: venda ganha em `deals`) disparem ações em outro (ex.: criar vaga rascunho em `ats_jobs` + notificar RH), configurável pelo usuário no builder de Workflows existente — sem hard-code por produto.

## Como funciona (visão do usuário)
1. Usuário abre **Workflows** → **Novo workflow**.
2. Escolhe entidade **Deals**, trigger **Stage changed** com filtro `stage = won` (ou `status = won`).
3. Adiciona ações, em qualquer ordem:
   - **Criar vaga (ATS)** — título, departamento, quantidade, `hiring_manager`, com tokens `{{company_name}}`, `{{amount}}`, `{{owner_id}}` do deal. Vaga é criada com `status = 'draft'` (rascunho pendente de aprovação).
   - **Notificar aprovador** — envia notificação in-app ao Head de RH (usuário/role escolhido) com link para revisar a vaga.
   - **Criar atividade** e **Webhook** (já existem hoje e passam a funcionar para deals).
4. Head de RH recebe notificação, abre vaga em rascunho no ATS e clica **Publicar** para mudar `status → open`.

Nada é criado direto como ativo — sempre passa por rascunho + aprovação humana, atendendo à resposta do usuário.

## Escopo técnico

### 1. Habilitar entidade `deals` no engine de workflows
Arquivo: `src/lib/workflows.functions.ts` e `src/lib/workflows/engine.server.ts`
- `EntityEnum` já inclui `deals` ✅ — verificar que o pipeline de emissão de `workflow_events` está ligado para deals (trigger no banco ou emissão via server-fn de update de stage). Se faltar, adicionar trigger `AFTER UPDATE OF stage_id ON deals` que insere em `workflow_events` com `event_type='stage_changed'`, `before`/`after`.
- Idem `activities` (já suportado) — sem mudança.

### 2. Novas actions no engine
Arquivo: `src/lib/workflows/engine.server.ts` + schema em `workflows.functions.ts`
- **`create_ats_job`**: cria linha em `ats_jobs` com `status='draft'`, `owner_id = ctx.ownerId`, campos com token rendering (`title`, `department`, `headcount`, `hiring_manager_id`, `linked_deal_id`). Emite `ats.job.created` via `recordAtsEvent`.
- **`create_requisition`** (opcional, mesma action com `requires_approval=true`): marca `pending_approval_by` = usuário/role alvo.
- Reforçar `send_notification` para gravar em `notifications` (tabela já existe) em vez de só logar.

### 3. Vínculo Deal ↔ Vaga
Migration:
- Coluna `linked_deal_id UUID` em `ats_jobs` (FK `deals.id`, nullable, index).
- Coluna `requires_approval BOOLEAN DEFAULT false` e `approved_by UUID`, `approved_at TIMESTAMPTZ` em `ats_jobs` (se não existirem — verificar antes).
- Nenhuma mudança em RLS (`ats_jobs` já é owner-scoped; herda permissões existentes de Head/admin conforme último trabalho).

### 4. UI do Workflow Builder
Arquivo: `src/components/workflows/*` (builder existente)
- Adicionar cards de ação **Criar vaga (ATS)** e ajustar **Notificar** com seletor de destinatário (user/role).
- Trigger de deals: mostrar campos `stage_id`, `status`, `amount` no seletor de filtro/tokens.

### 5. UI da vaga rascunho no ATS
Arquivo: `src/routes/_authenticated/(ats)/jobs.*`
- Filtro/aba **Rascunhos** já existe se `status='draft'` — verificar. Se não, adicionar chip.
- Botão **Publicar vaga** no detalhe da vaga quando `status='draft'` (permissão: Head de RH ou admin). Ao publicar: `status='open'`, `approved_by=auth.uid()`, `approved_at=now()`, emite `ats.job.approved`.
- Badge "Origem: Venda #123" no header da vaga quando `linked_deal_id` presente, com deep-link ao deal.

### 6. Notificações
- Aproveitar tabela `notifications` e sino `notifications-bell.tsx` já existentes.
- Action `send_notification` grava `{ user_id, title, body, link_url }` apontando para `/jobs/<id>`.

## Estrutura ASCII
```text
[Deal marcado como won]
        │
        ▼
[workflow_events: stage_changed]
        │
        ▼
[Engine tickWorkflows]
        │
        ├─► action: create_ats_job (status=draft, linked_deal_id)
        └─► action: send_notification → Head de RH
                                            │
                                            ▼
                                    [Rascunho no ATS]
                                            │
                                            ▼
                                    [Head aprova → open]
```

## Fora de escopo
- Aprovação multi-nível (cadeia). Fica para Onda 7.1.
- Mapeamento automático produto → template de vaga. Se necessário depois, virá como action separada `create_ats_job_from_product`.
- Integração com HRIS externo. Já existe adapter contract (Fase 0), sem uso ainda.
- Reversão automática se deal for reaberto (`won → outra stage`). Podemos discutir em iteração seguinte.

## Riscos
- Emissão de `workflow_events` para deals: se ainda não existir trigger, precisa ser criada com cuidado para não duplicar eventos.
- Loops (workflow que cria activity que dispara outro workflow): engine já tem dedupe por `(workflow_id, event_id)`.
- Permissão para "Publicar vaga": usar `requireTool('manage_jobs')` ou role Head/admin — já coberto pelo trabalho de hierarquia anterior.

## Como validar manualmente
1. Criar workflow: entidade Deals, trigger stage_changed → filtro `stage=won`, ações: `create_ats_job` + `send_notification` para Head de RH.
2. Marcar um deal como won.
3. Verificar vaga rascunho em `/jobs` com `linked_deal_id`.
4. Notificação chega no sino do Head de RH.
5. Head publica → status vira `open`.
