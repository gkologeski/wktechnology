## TechPeople — Sprint 1.5: Fechar HRIS + começar Resultados

A Sprint 1 do TechPeople entregou schema, server functions e as rotas `/people` e `/people/$id`. Faltam dois itens para fechar o Cadastro 360° e destravar o resto do módulo:

1. **Ação "Contratar candidato"** no TechHire (promoção → `people`).
2. **Painel de documentos com alerta de vencimento** já usável na ficha.

Depois disso, entra a **Sprint 2 (Resultados)** com metas e 1:1s — o que já dá valor de gestão real sem depender de NR-1.

### Escopo desta entrega

#### Parte A — Fechar Sprint 1 (HRIS)

- **Ação no ATS**: botão "Contratar" no detalhe do candidato, visível quando o candidato tem oferta aceita. Abre modal com `employment_type`, `role_title`, `hire_date`, `manager_id`, `cost_hour` e chama `promoteCandidateToPerson` (já existe). Redireciona para `/people/$id` após sucesso. Idempotente — se já foi promovido, apenas navega.
- **Painel de documentos** (`PersonDocumentsPanel`) na aba "Documentos" do `/people/$id`:
  - Upload para bucket `people-documents` (privado, RLS por `owner_id`).
  - Lista com tipo, nome, validade, status (`ok`, `expiring` <30d, `expired`), download via signed URL.
  - Server fns em `src/lib/people/documents.functions.ts` (já existe — apenas complementar com `uploadDocument`, `deleteDocument`, `listDocuments`).
- **Alerta automático**: view `people_documents_expiring` (docs com `expires_at` nos próximos 30 dias) usada por um card no topo de `/people` (só admin/HR).

#### Parte B — Iniciar Sprint 2 (Resultados)

- **Migration** para `people_goals` e `people_one_on_ones` com RLS já baseada em `can_view_person`:
  - `people_goals`: `person_id`, `title`, `description`, `metric`, `target`, `progress`, `period_start`, `period_end`, `status` (`open`/`at_risk`/`done`/`missed`), `project_id?`, `contract_id?`.
  - `people_one_on_ones`: `person_id`, `manager_id`, `scheduled_at`, `notes` (privado ao par), `action_items` (jsonb), `mood` (1–5).
  - `GRANT` + policies + trigger de audit + `enqueue_workflow_event`.
- **Rotas**:
  - `/people/$id/goals` — lista + criar/editar meta.
  - `/people/$id/1-on-1s` — lista + registrar 1:1 (visível só para gestor e a própria pessoa).
- **Componentes** reutilizando o design system: `MetricCard` para "Metas no prazo / em risco", `DataTable` para listagem, `FormSection` para o formulário. Sem novos primitivos.
- **Server functions** em `src/lib/people/goals.functions.ts` e `src/lib/people/one-on-ones.functions.ts` (list/get/upsert/archive), todas com `requireSupabaseAuth`.

### Fora do escopo desta entrega

- Avaliação do tomador via token público (Sprint 2 completa).
- Matriz de skills e heatmap (Sprint 2 completa).
- NR-1, pulse anônimo, alertas de burnout (Sprint 3).
- Painel de margem / bench / turnover (Sprint 4).

### Detalhes técnicos

- Bucket `people-documents`: criar via `supabase--storage_create_bucket`, privado. Policies para SELECT/INSERT/UPDATE/DELETE só quando `owner_id` do arquivo casa com workspace do usuário e `can_view_person_sensitive(person_id)` retorna true.
- Novas entidades adicionadas ao `workflow_events_entity_check`: `people_goals`, `people_one_on_ones`, `people_documents` — ampliar a constraint (mesmo padrão já usado).
- Rotas ficam sob `_authenticated/people.$id.goals.tsx` e `_authenticated/people.$id.one-on-ones.tsx` (nesting flat com ponto, como o projeto já usa).
- Sidebar do TechPeople ganha entrada "Metas" só quando dentro de uma pessoa (mantém o menu do módulo enxuto — Metas é aba do detalhe, não item raiz).
- Ordem canônica de campos das novas entidades adicionada em `src/lib/workflows/entity-field-order.ts` para consistência no Workflow Builder.

### Ordem de execução

1. Migration Parte A (bucket + policies + view de docs vencendo).
2. Complementar `documents.functions.ts` (upload/list/delete) e `PersonDocumentsPanel`.
3. Botão "Contratar" no detalhe do candidato ATS + modal.
4. Migration Parte B (goals + one_on_ones + workflow_events_entity_check).
5. Server functions + rotas de goals e 1:1s.
6. Validações: `bun run typecheck` e `bun run build`.

Confirma seguir com Sprint 1.5 + início da Sprint 2 nesse recorte? Se preferir só fechar a Sprint 1 (Parte A) agora e deixar a Sprint 2 para depois, me diz que corto pela metade.