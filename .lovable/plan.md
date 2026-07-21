## Objetivo

Hoje os workflows só operam em 9 entidades (CRM + ATS). O plano estende o motor para cobrir Finance, Projects, Services, Contracts, Products e Quotes — como origem de trigger (created / updated / stage_changed / time-based) e como alvo de ações (create / update / associate / disassociate / delete) — permitindo automações cross-módulo (ex.: "deal ganho → criar projeto + contrato + fatura recorrente").

## Escopo confirmado

- **Módulos alvo:** TechFinance, TechProjects, TechServices, Contracts, Products, Quotes/Proposals.
- **Ações:** Create, Update (set/clear/increment), Associate/Disassociate, Delete (soft/arquivar).
- **Triggers:** paridade total — created, updated, stage_changed, time-based.
- **Entrega:** tudo junto, em fases internas para reduzir risco.

## Entidades e campos-chave

| Entidade | Tabela | stage_changed em | owner_id | Notas |
|---|---|---|---|---|
| Projetos | `projects` | `status` | ✓ | |
| Tarefas de projeto | `project_tasks` | `status_id` | ✓ | FK: project_id |
| Milestones | `project_milestones` | `status` | ✓ | |
| Time entries | `project_time_entries` | — | ✓ | apenas created/updated |
| Contratos | `contracts` | `status` | ✓ | |
| Serviços | `services` | `status` | ✓ | |
| Produtos | `products` | `status` (se existir) / `active` | ✓ | |
| Cotações | `quotes` | `status` | ✓ | |
| Propostas | `proposals` | `status` | ✓ | |
| Lançamentos | `financial_entries` | `status` | ✓ | |
| Faturas | `customer_invoices` | `status` | ✓ | |
| Pagamentos | `bank_payments` | `status` | ✓ | |
| Recorrências | `recurring_plans` | `status` | ✓ | |

(Auditar `owner_id` e coluna de status na migração antes de gerar triggers; ajustar caso o nome divirja.)

## Fase A — Núcleo (types, schemas, motor genérico)

1. **`src/lib/workflows/types.ts`**: expandir `WorkflowEntity` com as 13 tabelas acima.
2. **`src/lib/workflows/schemas.ts`**: expandir `EntityEnum` idem; adicionar 4 ações **genéricas** que substituem a explosão de `create_project`, `create_invoice` etc.:
   - `create_record { entity, fields }`
   - `update_record { entity?, target: "current"|"association", association?, fields }` (patch parcial; suporta `set/clear/increment` via marcadores `{ op: "increment", value }`)
   - `delete_record { entity?, target, soft?: boolean }` (soft = marca `deleted_at`/`archived_at` quando existir; senão hard delete)
   - `associate_record` / `disassociate_record` já existem — estender `ENTITY_ASSOCIATIONS` para os novos módulos.
   - Manter os `create_lead`, `create_deal` etc. atuais como aliases (compat).
3. **`src/lib/workflows/engine.server.ts`**: implementar despacho genérico em cima de `supabaseAdmin.from(entity)`, aplicando `owner_id`, resolvendo tokens/variáveis e coerção de tipos (reutilizar helpers existentes). Validar `entity` contra whitelist e `fields` contra `custom_properties`/schema conhecida.
4. **`src/lib/workflows/associations.ts`**: adicionar FKs cross-module (ex.: `projects.deal_id → deals`, `contracts.deal_id → deals`, `customer_invoices.contract_id`, `project_tasks.project_id`, `quote_line_items.quote_id`).
5. **Time triggers** (`tickTimeTriggers`): tabela → campo timestamp default (`updated_at`/`created_at`/`due_date`); registrar no dicionário existente.

## Fase B — Emissão de eventos (DB)

Migração única que:

1. Atualiza `public.enqueue_workflow_event()` estendendo o `case` de `stage_changed` para as novas tabelas (comparando o campo de status apropriado).
2. Cria `AFTER INSERT OR UPDATE FOR EACH ROW` chamando `enqueue_workflow_event('<entity>')` para cada tabela nova, usando o padrão `if not exists (select 1 from pg_trigger …)` já usado.
3. GRANTs e políticas de `workflow_events` não mudam (owner_id derivado da linha).

## Fase C — Ações cross-module

Motor sempre resolve o `owner_id` do registro criado a partir do `owner_id` do evento (RLS-safe). Para `associate_record` cross-entity, validar que ambas as linhas pertencem ao mesmo `owner_id`.

Cenários que passarão a funcionar:

- Deal fechado → `create_record` project + `create_record` contract + `associate_record` invoice↔contract.
- Fatura paga (`customer_invoices.status = paid`) → `create_record` financial_entry (receita) + `update_record` deal (`stage = closed_won`).
- Projeto concluído → `update_record` deal + `create_record` financial_entry recorrente.
- Time entry criada → `increment` `project.hours_logged`.

## Fase D — UI (Workflow Builder)

1. `src/components/workflows/workflow-builder.tsx`: entity selector passa a listar as 22 entidades agrupadas por módulo (CRM / ATS / Finance / Projects / Services / Contracts / Products / Quotes).
2. Action picker: novo item **"Criar registro em outro módulo"** que abre seleção de entidade alvo e depois renderiza `ExtraFieldsEditor` da entidade escolhida (já existe, apenas passar `entity` dinâmica). Idem para update/delete/associate.
3. `use-reference-labels`: registrar labels amigáveis para os novos FKs.
4. Filtros/`FilterBar`: expor `custom_properties` das novas entidades no seletor de campo.

## Fase E — Docs, testes, checklist

- `docs/workflows-cross-module.md` novo: matriz entidade × trigger × ação, exemplos JSON.
- Atualizar `docs/backlog-pendencias.md` marcando fases entregues.
- Vitest para o dispatcher genérico (`create_record`, `update_record`, whitelisting de entity).
- E2E leve: publicar um workflow "deal.stage_changed=won → create_record projects" e verificar `workflow_runs` ok.

## Fases de entrega (internas)

1. **A + B** juntos: núcleo + triggers de DB (uma migração). Sem UI ainda — testável via `applyToExisting`.
2. **C**: ações genéricas + associações. Sem UI de criação, mas já executa via JSON.
3. **D**: UI Builder cobrindo todas as entidades e ações genéricas.
4. **E**: docs + testes + smoke.

## Fora do escopo (será listado como pendência)

- Novos webhooks/eventos de domínio para módulos ainda não instrumentados (ex.: gateway externo pagando fatura sem passar pela app).
- Delete "hard" com CASCADE em módulos financeiros — usaremos apenas soft-delete/arquivar por segurança contábil.
- Reprojetar tela de "aplicar workflow aos existentes" — continuará operando na entidade origem selecionada.

## Riscos

- Volume de triggers de DB novos: mitigado por reutilizar a função única `enqueue_workflow_event`.
- Ações genéricas contra tabelas com colunas obrigatórias específicas (ex.: `customer_invoices` exige `legal_entity_id`) — dispatcher deve validar e emitir erro amigável em `workflow_runs.error`.
- Backfill de `stage_changed` só passa a valer depois da migração (documentado).

## Validação manual

1. Publicar workflow: entidade=`deals`, trigger=`stage_changed` filtro `stage=won`, ação `create_record` entity=`projects` name=`{{deal.name}}`.
2. Mover deal para "won" → `workflow_runs.status=success`, `projects` recebe linha com FK `deal_id` preenchida.
3. Repetir para `customer_invoices.status=paid` → `financial_entries` de receita.
4. Rodar `security--run_security_scan` antes de publicar.
