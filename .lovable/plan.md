# Correções TechPeople — abas sensíveis, cadastro completo e auditoria de entradas

## Diagnóstico (confirmado por leitura)

### 1. Abas Psicossocial / Incidentes / Benefícios não aparecem
Em `src/routes/_authenticated/people.$id.tsx` (linhas 243-245, 427-443) as três abas só são renderizadas quando `p.can_view_sensitive === true`.

Esse flag é definido em `src/lib/people/people.functions.ts:167-170` pela RPC `can_view_person_sensitive`, que hoje é:

```sql
SELECT EXISTS ( ... WHERE public.is_workspace_admin_v2(auth.uid(), p.owner_id) )
```

Ou seja, **só admins do workspace** enxergam as abas. Um CEO/gestor com cargo funcional (job_role) sem o bundle "workspace_admin" não vê nada — que é o caso do usuário logado. Isso não bate com o RBAC granular já implementado (`people.sensitive.read`, `people.psychosocial.read`, etc.).

### 2. Cadastro "Nova pessoa" com poucos campos
O dialog em `src/routes/_authenticated/people.index.tsx:260-363` expõe apenas 4 campos: nome, e-mail, cargo, vínculo. O `upsertSchema` (`people.functions.ts:75-100`) aceita ~20 campos (telefone, senioridade, localização, timezone, data de admissão, gestor, razão social, CNPJ, custo/hora, custo mensal, tags, notas, status). O restante só é editável entrando na ficha depois — atrito grande e nenhuma sinalização de que existem mais campos.

### 3. Auditoria de pontos de entrada
Sidebar TechPeople (`src/lib/menu-config-people.ts`) hoje cobre: Pessoas, Meu time, Documentos a vencer, Faturamento de horas, Margem por contrato, Analytics, Modelos de onboarding. Faltam entradas para funcionalidades já implementadas nas Sprints 3–14: Riscos Psicossociais (agregado), Incidentes (agregado), Benefícios & Custos, Compliance de Offboarding, Onboarding em andamento.

---

## Escopo (o que será feito)

### Fase A — Abas sensíveis integradas ao RBAC
1. Substituir o gate `can_view_sensitive` para considerar também o RBAC granular. Server:
   - Em `getPerson`, além do check `is_workspace_admin_v2`, checar `assertAnyPermission` com as chaves `people.sensitive.read` (financeiro) e `people.psychosocial.read` / `people.incidents.read` / `people.benefits.read`. Retornar 4 flags separadas: `can_view_financial`, `can_view_psychosocial`, `can_view_incidents`, `can_view_benefits` (em vez de um booleano único).
2. `PersonRow` passa a expor as 4 flags; UI mostra cada aba conforme a flag específica. Fallback: se nenhuma existe ainda no seed, tratar admin como sempre `true`.
3. Semear (se ainda não existirem) as chaves `people.psychosocial.read/write`, `people.incidents.read/write`, `people.benefits.read/write`, `people.sensitive.read/write` na matriz `/settings/permissions`, atribuindo por padrão a Manager+ e ao cargo CEO.
4. Ajustar `PsychosocialPanel`, `IncidentsPanel`, `BenefitsPanel` para receber `canWrite` derivado da flag correspondente (não do genérico).

### Fase B — Cadastro completo em "Nova pessoa"
Reescrever o dialog `NewPersonDialog` como formulário em seções (usando `FormSection` padrão TechHire) — sem sair da tela, ampliando a UX de cadastro:

- **Identificação**: nome*, nome preferido, foto (URL), e-mail, telefone.
- **Trabalho**: cargo, senioridade, vínculo, status, gestor (RecordPicker de people), localização, timezone, data de admissão.
- **Legal**: razão social, CNPJ.
- **Financeiro** (só se `people.sensitive.write`): custo/hora, custo mensal, moeda.
- **Outros**: tags (chips), notas.

Todos passam pela mesma `upsertPerson`; validação client via zod espelhando o schema server. Botão "Salvar e abrir ficha" leva para `/people/:id`.

### Fase C — Pontos de entrada faltantes no sidebar TechPeople
Adicionar em `src/lib/menu-config-people.ts` (respeitando `need`):

- **Saúde & segurança** (grupo novo, `need: "manager"`):
  - Riscos psicossociais → nova rota `/people/psychosocial` (dashboard agregado — lista + KPIs por categoria).
  - Incidentes → nova rota `/people/incidents` (lista consolidada, filtros por status/severidade).
- **Benefícios & custos** → nova rota `/people/benefits` (lista de benefícios ativos por pessoa, custo total).
- **Onboarding em andamento** → nova rota `/people/onboarding` (execuções `people_onboarding_runs` em progresso).
- **Compliance de offboarding** → nova rota `/people/offboarding` (pessoas em `offboarding`/`terminated` com pendências).

Cada rota nova reaproveita os componentes de painel existentes (Psychosocial/Incidents/Benefits/Offboarding/OnboardingPanel), mas em modo "workspace-wide" — server functions passam a suportar consulta agregada (por owner_id do workspace) além do modo per-person atual, protegidas pelo mesmo RBAC.

Todas as novas rotas herdam padrões TechHire: `AtsPageHeader`/`PageHeader`, `MetricCard`, `FilterBar`, `DataTable`, `EmptyState`, `LoadingSkeleton`, `ErrorState`, respeitando light/dark e responsividade.

### Fase D — Verificação
- Ligar como CEO e conferir se as 3 abas voltam a aparecer.
- Cadastrar pessoa com todos os campos preenchidos.
- Abrir cada nova rota do sidebar e validar EmptyState + dados reais.
- `tsgo` (typecheck) e `vitest run` nos testes de access-control.

---

## Detalhes técnicos

- **Migração**: novo seed de permissões em `supabase/migrations/`, idempotente (`INSERT ... ON CONFLICT DO NOTHING`) para as chaves `people.psychosocial.*`, `people.incidents.*`, `people.benefits.*`, `people.sensitive.*`. Sem alterar RLS de `people_psychosocial_assessments` (RLS existente já protege por owner_id + admin).
- **RPC**: pode-se manter `can_view_person_sensitive` para compatibilidade, mas criar `can_view_person_scope(_person_id uuid, _scope text)` retornando bool a partir da checagem RBAC + admin.
- **Rotas novas**: `people.psychosocial.tsx`, `people.incidents.tsx`, `people.benefits.tsx`, `people.onboarding.tsx`, `people.offboarding.tsx` sob `_authenticated/`, cada uma com `head()` próprio (title/description/og únicos).
- **Sem alterar** schemas de negócio, autenticação, ou remover funcionalidades existentes.

## Fora de escopo
- Redesign visual dos painéis existentes.
- Alterar campos do modelo `people` (nenhuma coluna nova).
- Fluxo de aprovação/assinatura de avaliações psicossociais.
- Migração para novo layout de ficha 360°.
