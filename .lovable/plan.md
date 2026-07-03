
# Workflow Builder no padrão HubSpot (escopo ampliado)

## Objetivo

Substituir o Sheet atual por um builder inspirado em `knowledge.hubspot.com/workflows/create-workflows`: **canvas vertical de passos** (gatilho no topo, passos abaixo conectados por linhas com botão "+"), **painel direito** para configurar o passo selecionado e **painel esquerdo** com metadados. Além do redesenho, incorporar os recursos que antes estavam fora de escopo — **ramificações if/else**, **delays** e **re-enrollment triggers** — para paridade funcional com HubSpot.

Todos os módulos continuam disponíveis (Vendas, Atendimento, Recrutamento), selecionados numa etapa inicial "Escolher tipo de workflow".

## Fluxo do usuário

1. **Escolher tipo** — modal inicial com cartões agrupados por módulo (Vendas / Atendimento / Recrutamento) sobre `ENTITY_GROUPS`.
2. **Nomear** — nome + switch ativo/pausado no header.
3. **Gatilho de entrada** — primeiro card do canvas; painel direito com evento (`created`/`updated`/`stage_changed`) + filtros.
4. **Re-enrollment** — seção dentro do painel do gatilho: toggle "Permitir reinscrição" + escolha de eventos que reinscrevem um registro já processado.
5. **Adicionar passos** — botão "+" entre cards abre biblioteca de ações agrupada por categoria:
   - **Controle de fluxo**: `delay` (esperar N minutos/horas/dias), `branch_if` (ramificação if/else baseada em filtros do registro).
   - **CRM**: `set_field`, `assign_to`, `rotate_assign`.
   - **Comunicação**: `create_activity`, `send_notification`.
   - **Sequências**: `add_to_sequence`.
   - **Recrutamento (ATS)**: `create_ats_job`, `create_ats_candidate`, `advance_ats_application_stage`, `assign_recruiter`.
   - **Externo**: `webhook`.
6. **Selecionar card** — abre formulário do passo no painel direito.
7. **Reordenar / remover** — drag handle, lixeira, atalhos de teclado.
8. **Revisar e salvar** — rodapé fixo Cancelar / Salvar.

## Layout visual

```text
┌────────────────────────────────────────────────────────────────┐
│ Header: [Nome]   [Switch Ativo]   [Cancelar] [Salvar]          │
├──────────────┬──────────────────────────────┬──────────────────┤
│ Sidebar esq. │        Canvas (centro)        │ Painel direito   │
│              │                               │                  │
│ Tipo:        │   ┌──────────────────────┐    │ [Config do card  │
│ Negócios     │   │ ⚡ Gatilho + Reenroll │    │  selecionado]    │
│              │   └──────────┬───────────┘    │                  │
│ Passos: 4    │              +                │ ou               │
│              │   ┌──────────▼───────────┐    │                  │
│ Preview →    │   │ 1. Esperar 1 dia     │    │ [Biblioteca de   │
│              │   └──────────┬───────────┘    │  ações agrupada  │
│              │              +                │  por categoria]  │
│              │   ┌──────────▼───────────┐    │                  │
│              │   │ 2. Se stage=won      │    │                  │
│              │   │   ├─ Sim: criar vaga │    │                  │
│              │   │   └─ Não: notificar  │    │                  │
│              │   └──────────────────────┘    │                  │
└──────────────┴──────────────────────────────┴──────────────────┘
```

Responsivo: canvas 100% no mobile, sidebar esquerda colapsável, painel direito vira Sheet.

## Escopo técnico

### 1. Tipos (`src/lib/workflows/types.ts`)

Adicionar às uniões existentes, sem remover nada:

- `WorkflowAction` ganha:
  - `{ type: "delay"; amount: number; unit: "minutes" | "hours" | "days" }`
  - `{ type: "branch_if"; filters: WorkflowFilter[]; then: WorkflowAction[]; else: WorkflowAction[] }`
- `WorkflowTrigger` ganha `reenroll?: { enabled: boolean; events: WorkflowEventType[] }`.
- `ACTION_LABELS` recebe entradas em pt-BR para `delay` ("Esperar") e `branch_if` ("Se / Então / Senão").
- Novo agrupamento `ACTION_CATEGORIES: Record<string, WorkflowActionType[]>` para dirigir a UI da biblioteca.

### 2. Server functions (`src/lib/workflows.functions.ts`)

- `ActionSchema` vira `z.lazy(...)` para suportar recursão de `branch_if`.
- Adicionar variantes Zod:
  - `delay`: `amount` int 1–10080, `unit` enum.
  - `branch_if`: `filters` (reaproveita `FilterSchema`), `then` / `else` como arrays da própria união, com `.max(20)` em cada ramo e profundidade limitada (helper `MAX_DEPTH = 3` validado manualmente para evitar recursão infinita).
- `TriggerSchema` recebe `reenroll` opcional.

### 3. Engine (`src/lib/workflows/engine.server.ts`)

- **Delays**: usar tabela existente `workflow_events` com nova coluna `run_at timestamptz` (migration abaixo). Quando o passo é `delay`, a engine agenda a continuação re-enfileirando o evento com `run_at = now() + interval` e um `cursor` (índice do próximo passo) no payload; o worker só processa eventos com `run_at <= now()`.
- **Branches**: novo helper `evaluateFilters(record, filters)` reaproveitando a lógica de filtro do trigger; executa `then` ou `else` recursivamente com o mesmo `ctx`.
- **Re-enrollment**: `enqueue_workflow_event` (SQL) já grava todos os eventos; a engine, ao processar, marca `workflow_runs` com `record_id` e checa histórico. Reinscrição só é bloqueada quando `trigger.reenroll.enabled === false` **e** já existe run bem-sucedido para o mesmo `(workflow_id, record_id)`. Se habilitada, os eventos listados em `reenroll.events` sempre reprocessam.

### 4. Banco (`supabase/migrations/<nova>.sql`)

- `ALTER TABLE public.workflow_events ADD COLUMN IF NOT EXISTS run_at timestamptz NOT NULL DEFAULT now();`
- `ALTER TABLE public.workflow_events ADD COLUMN IF NOT EXISTS cursor jsonb;` (guarda posição em branches/delays).
- Índice `CREATE INDEX IF NOT EXISTS workflow_events_run_at_idx ON public.workflow_events (run_at) WHERE processed_at IS NULL;`
- Sem mudanças em RLS/GRANT (colunas adicionais em tabela existente já coberta).

### 5. UI (`src/components/workflows/workflow-builder.tsx`)

Reescrever para o novo layout, reaproveitando componentes internos:

- `EntityPickerDialog` — modal inicial.
- `CanvasStep` — card genérico do canvas.
- `BranchStep` — card especial com duas colunas filhas (Sim / Não) usando `CanvasStep` recursivo.
- `StepConnector` — linha + botão `+` (também no fim de cada ramo de branch).
- `ActionLibraryPanel` — lista agrupada por `ACTION_CATEGORIES`.
- `StepConfigPanel` — reutiliza os formulários já existentes (`set_field`, `create_activity`, `assign_to`, `rotate_assign`, `add_to_sequence`, `send_notification`, `webhook`, `create_ats_job`, `advance_ats_application_stage`, `create_ats_candidate`, `assign_recruiter`) e adiciona:
  - Form `delay`: input numérico + select de unidade + preview textual ("Esperar 2 horas").
  - Form `branch_if`: reaproveita o editor de filtros do trigger; ramos `then`/`else` editáveis via `CanvasStep` embutido.
  - Form do trigger ganha bloco "Reinscrição" (switch + multi-select de eventos).
- Rodapé fixo Cancelar / Salvar; validação exige nome + ao menos 1 ação em cada ramo populado.

### 6. Menu (`src/routes/_authenticated/settings.workflows.tsx`)

Nenhuma mudança de rota. Trocar `Sheet` por `Dialog` full-screen mantendo props (`open/draft/onClose/onSave`).

## Sem alteração

- `src/lib/menu-config.ts`, permissões (`requireTool("manage_workflows")`), RLS.
- Listagem/execuções em `settings.workflows.tsx` (Tabs, cards, `WorkflowRunsList`).
- `EMPTY_DRAFT` continua com os defaults atuais (adicionará `trigger.reenroll = { enabled: false, events: [] }`).

## UX / acessibilidade

- Foco visível, `role="button"` + `aria-pressed` nos cards.
- Painel direito com `aria-live="polite"` ao trocar de passo.
- Botão "+" com `aria-label="Adicionar ação"`.
- Teclado: setas para reordenar, `Delete` para remover, `Enter` para abrir config.
- Tokens semânticos apenas (`bg-card`, `border-border`, `text-muted-foreground`).
- Light/dark validados.
- Responsivo: painel direito vira `Sheet` em mobile.

## Validação manual

1. `/settings/workflows` → "Novo workflow": modal de escolha de tipo com 3 grupos aparece.
2. Selecionar "Negócios" → canvas com card de gatilho pré-preenchido.
3. Configurar `stage_changed` + filtro `stage = won`; habilitar reinscrição com evento `stage_changed`.
4. Adicionar "Esperar 1 hora" → "Se stage = won" com ramo "Sim: criar vaga (ATS)" e "Não: enviar notificação".
5. Salvar; reabrir; garantir que branches, delay e reenroll persistem.
6. Executar (workflow rodando em fixture) e conferir em "Execuções recentes":
   - Registro processado uma vez respeita `reenroll.enabled=false`; com `true`, reprocessa.
   - Delay: run marcado como pendente até `run_at` vencer.
   - Branch: log mostra ramo executado.
7. Repetir para entidade "Aplicações (ATS)" com ação "Mover para etapa".
8. Validar mobile (Sheet direito) e dark mode.

## Riscos e mitigações

- **Recursão de tipos Zod**: usar `z.lazy` + limite de profundidade em runtime.
- **Backfill de `run_at`**: `DEFAULT now()` cobre linhas existentes; nenhuma migração destrutiva.
- **Loops via reinscrição**: engine deduplica por `(workflow_id, record_id, hash(trigger))` dentro da mesma janela de 60s.
- **Compatibilidade de workflows antigos**: ausência de `reenroll`, `delay`, `branch_if` mantém comportamento atual.
