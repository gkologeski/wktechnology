
# TechPeople — Gestão de Pessoas & Outsourcing

Novo módulo do ERP para o "meio" que hoje falta entre TechHire (entrada), Contracts (vínculo), Projects (execução) e Finance (custo). Cobre HRIS, Resultados, Psicossocial (NR-1) e VMS/Outsourcing.

## Escopo confirmado

- Universo: **prestadores PJ ativos** + **candidatos aprovados no TechHire** (promoção automática ao contratar).
- Confidencialidade em 3 camadas:
  - **RH/Admin**: vê tudo (custo, avaliações, respostas psicossociais nominais são anônimas mesmo para RH).
  - **Gestor**: vê seu time (dados operacionais, avaliações que fez, resultados; sem custo do PJ).
  - **Pessoa**: vê só o próprio.
- Módulo cross-integrado: Contracts, Projects, TechHire, Finance.
- Nome: **TechPeople** (host `techpeople.wktechnology.com.br`, rota base `/people`).

## Arquitetura

### Modelo central: `people`

`people` é a "pessoa viva" — distinta de `ats_candidates` (funil) e `profiles` (usuário do sistema). Um candidato aprovado gera uma `person`; a pessoa pode ou não ter `profile` (login).

```text
ats_candidates ──approve──▶ people ◀──── profiles (opcional, se tiver acesso ao ERP)
                              │
                              ├─▶ contracts (parent_contract_id: venda ↔ compra)
                              ├─▶ project_members / project_time_entries
                              ├─▶ people_goals / people_reviews / people_one_on_ones
                              └─▶ people_pulse_responses (anônimas)
```

### Tabelas novas (11)

| Tabela | Papel |
|---|---|
| `people` | Ficha 360°: dados pessoais, PJ, custo hora, status (ativo/bench/desligado), gestor, `candidate_id`, `profile_id`, `owner_id` (workspace) |
| `people_documents` | RG, CNPJ, contrato social, certidões, foto — com validade e alerta |
| `people_allocations` | Vínculo pessoa ↔ projeto/cliente com % alocação, período, papel |
| `people_skills` | Matriz de skills (tag + nível 1–5 + certificações) |
| `people_goals` | OKRs/metas por pessoa e por período; ligados a projeto ou conta |
| `people_reviews` | Avaliação de desempenho e **avaliação do tomador (cliente)** sobre o prestador |
| `people_one_on_ones` | Registros de 1:1 gestor ↔ pessoa (privado ao par) |
| `people_pulse_surveys` | Templates de pulse (eNPS, riscos psicossociais NR-1) |
| `people_pulse_responses` | Respostas **anônimas** (sem `person_id`, só hash + agregados) |
| `people_alerts` | Alertas de burnout, doc vencido, bench prolongado, queda de eNPS |
| `people_events` | Timeline unificada (histórico consolidado) |

Todas herdam padrão do ERP: `id`, `owner_id` (workspace), `created_at`, `updated_at`, triggers de audit e enqueue_workflow_event.

### RLS por camadas

Function nova `public.can_view_person(_person_id uuid)`:
- true se `has_role(workspace_admin)` OU `has_role(hr)` OU `people.manager_id = auth.uid()` (via profile) OU `people.profile_id = auth.uid()` (é a própria pessoa).

Function `public.can_view_person_sensitive(_person_id uuid)`:
- true só para HR/Admin. Usada para colunas `cost_hour`, `personal_doc`, `salary_pj`.

Views split:
- `people_public` (sem colunas sensíveis) — usada por gestor e pela própria pessoa.
- `people_full` — usada por HR/Admin.

Pulse responses **nunca** têm `person_id`. Anonimato preservado por design.

## Fases de entrega

### Fase 1 — Cadastro 360° (HRIS)
- Migration: `people`, `people_documents`, `people_events`, `can_view_person*`, RLS.
- Rota `/people` (lista) + `/people/$id` (ficha com 6 abas: Overview, Contratos, Projetos, Documentos, Timeline, Custos [restrito]).
- Componentes: `PersonPageHeader`, `PersonMetricRow` (tempo de casa, alocação %, contratos ativos, projetos ativos), `PersonDocumentsPanel` com alerta de vencimento.
- Ação **"Contratar candidato"** em `ats_candidates` (status `offer_accepted`) → server fn `promoteCandidateToPerson` cria `person`, vincula ao contrato quando existir.
- Sidebar: adicionar entrada `TechPeople` em `src/lib/menu-config-people.ts`; registrar em `modules/registry.ts`.

### Fase 2 — Resultados
- Migration: `people_goals`, `people_reviews`, `people_one_on_ones`, `people_allocations`, `people_skills`.
- Rota `/people/$id/goals`, `/people/$id/reviews`, `/people/$id/1-on-1s`.
- **Avaliação do tomador**: gera link público tokenizado (rota `/review.$token.tsx`) enviado ao PM do cliente após fechamento de sprint/marco de projeto — 5 perguntas (qualidade, prazo, comunicação, autonomia, recomendaria).
- Matriz de skills com heatmap por conta/projeto.

### Fase 3 — Psicossocial (NR-1)
- Migration: `people_pulse_surveys`, `people_pulse_responses` (anônimas), `people_alerts`.
- Template padrão embarcado: **Inventário de Riscos Psicossociais NR-1** (17 perguntas Copsoq-BR abreviado) + eNPS.
- Rota `/people/pulse` (RH gerencia campanhas) e `/pulse.$token.tsx` (público, anônimo).
- Alertas automáticos (cron 15 min existente): burnout (eNPS < 6 + horas > 200/mês + faltas), doc vencido, bench > 30 dias.
- Dashboard psicossocial agregado (mínimo 5 respostas por agrupamento para preservar anonimato).

### Fase 4 — VMS/Outsourcing (o diferencial)
- Rota `/people/margin` — painel por pessoa: receita mensal (via `contracts` de venda) − custo mensal (via `contracts` de compra ligado por `parent_contract_id`), margem R$ e %.
- Rota `/people/bench` — quem está sem alocação ativa; tempo em bench; skills disponíveis.
- Rota `/people/turnover` — turnover por cliente/projeto/gestor; alerta preditivo (queda de eNPS + reviews baixas + bench).
- Widget "Saúde da conta" reutilizável no detalhe do cliente em TechSales.

## Detalhes técnicos

- Todas as server functions em `src/lib/people/*.functions.ts` (`requireSupabaseAuth`).
- Layout gates: `_authenticated/people/` para app; `/pulse.$token` e `/review.$token` públicas (com verificação de token single-use).
- Reaproveita padrões existentes: `ats_page_header` → `PeoplePageHeader`, `MetricCard`, `FilterBar`, `DataTable`, `EmptyState`, `StatusBadge`.
- Workflows: entrada nova `person` no CHECK constraint de `workflow_events`; triggers `enqueue_workflow_event` em `people`, `people_goals`, `people_reviews`, `people_alerts`.
- Anonimato psicossocial garantido por: (1) sem `person_id`; (2) k-anonymity ≥ 5 na consulta; (3) grants restritos ao role HR.
- Módulo em `modules/registry.ts` com `defaultRoute: "/people"`, `icon: UserCog`, cor `#059669`.

## Roadmap sugerido

1. **Sprint 1** — Fase 1 (Cadastro + promoção do candidato + doc panel).
2. **Sprint 2** — Fase 2 (Metas, 1:1 e avaliação do tomador via token público).
3. **Sprint 3** — Fase 3 (NR-1 + eNPS + alertas automáticos).
4. **Sprint 4** — Fase 4 (Painel de margem, bench, turnover, widget de saúde da conta).

Confirma esse recorte para eu detalhar a Sprint 1 e começar pela migration + rota `/people`? Se quiser cortar algo (ex.: adiar 1:1s, adiar skills), me diz agora que ajusto o plano.
