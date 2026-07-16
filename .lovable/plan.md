## Objetivo

Eliminar a necessidade de F5 após qualquer edição em modal/diálogo/drawer em **todas** as telas do sistema. Ao fechar o modal (ou ao voltar o foco), listas, detalhes, kanbans, timelines e painéis devem refletir os dados atualizados automaticamente.

## Diagnóstico

O app hoje mistura três padrões de fetch, o que produz o bug de forma irregular:

1. **TanStack Query** — invalida corretamente quando `queryClient.invalidateQueries` é chamado, mas muitos modais não invalidam (ou invalidam key errada).
2. **`useState` + `useEffect` + `supabase.from(...)`** com um `load()` local (ex.: `leads.$id.tsx`, `deal-line-items`, várias telas ATS) — sem cache central; dependem de callback `onSaved` que muitos modais não recebem/chamam.
3. **Realtime via `useRealtimeInvalidate`** — presente em algumas telas, ausente em outras.

Além disso, o `QueryClient` está com `refetchOnWindowFocus: false`, então voltar o foco não revalida nada.

## Escopo — todas as telas

Correção transversal de UX de sincronização em todo o app, sem alterar RLS, schema, regras de negócio ou lógica de save dos modais. Foco em presentation + data layer.

## Plano de implementação

### Fase 1 — Rede de segurança global (aplica-se a todas as telas)

- Em `src/router.tsx`, ajustar defaults do `QueryClient`:
  - `refetchOnWindowFocus: true`
  - `refetchOnReconnect: true`
  - manter `staleTime: 60_000` (evita tempestade de requests em navegação normal, mas revalida ao reganhar foco).
- Confirmar `defaultPreloadStaleTime: 0` (já está).

Impacto: qualquer tela consumindo Query passa a revalidar ao voltar o foco à aba/janela sem código extra.

### Fase 2 — Hooks utilitários reutilizáveis

Criar em `src/hooks/`:

- `use-invalidate-on-close.ts` — recebe `open: boolean` e `keys: QueryKey[]`; ao transicionar de aberto→fechado invalida as keys.
- `use-refetch-on-focus.ts` — recebe callback ou keys e dispara em `visibilitychange` + `focus` do window; usado em telas que ainda dependem de `useState + load()`.
- `use-entity-sync.ts` — helper que combina Realtime (`useRealtimeInvalidate`) + invalidação em foco para uma entidade (`leads`, `contacts`, `companies`, `deals`, `tickets`, `activities`, etc).

### Fase 3 — Contrato padrão de modais

Auditoria completa dos modais/diálogos/drawers em `src/components/**/*dialog*.tsx`, `*drawer*.tsx`, `*wizard*.tsx` (aprox. 40+ arquivos: create/edit dialogs de leads, contacts, deals, companies, tickets, activities, meetings, tasks, quotes, offers, candidates, jobs, applications, interviews, sequences, snippets, surveys, forms, workflows, branding, etc).

Para cada um:
- Garantir prop `onSaved?: () => void` (ou `onCreated` / `onUpdated` conforme convenção existente).
- Após `save` bem sucedido, chamar `onSaved?.()` **antes** de `onOpenChange(false)`.
- Onde o modal não expõe callback, envolver com `useInvalidateOnClose` passando as keys da tela pai.

Padronizar assinatura via type helper `EntityDialogProps<T>` em `src/lib/dialog-contract.ts` para servir de referência.

### Fase 4 — Migrar telas de detalhe para Query

Onde ainda usam `useState + load()`, criar `queryOptions` reutilizáveis (`src/lib/entity-queries.ts`) com chaves normalizadas:

- Lista: `[entity, "list", filters?]`
- Detalhe: `[entity, id]`
- Timeline/atividades: `["activities", { relatedKey, relatedId }]`
- Associações: `["associations", entity, id]`

Rotas alvo (varredura completa em `src/routes/_authenticated/**`):

- `leads.$id`, `contacts.$id`, `companies.$id`, `deals.$id`, `tickets.$id`
- `activities.$id`, `notes`, `tasks`, `emails`, `meetings.$id`
- ATS: `candidates.$id`, `jobs.$id`, `applications.$id`, `interviews.$id`, `offers.$id`, `pipelines.$id`
- Settings: telas com CRUD via `CrudSettings` já usam Query; garantir invalidação após modal.

Onde a migração completa for arriscada (tela muito grande), aplicar o padrão mínimo: envolver `load()` em `useQuery` sem mudar UI, e trocar chamadas manuais por `queryClient.invalidateQueries`.

### Fase 5 — Realtime nas telas de detalhe

Plugar `useRealtimeInvalidate` em todas as rotas de detalhe de entidade, escutando a própria tabela + `activities` + tabelas associativas relevantes (`deal_contacts`, `deal_line_items`, `activity_comments`, `meetings`, `email_messages`, etc). Reutiliza hook já existente.

### Fase 6 — Componentes compostos que atualizam localmente

Componentes que hoje mantêm estado próprio e não avisam o pai (`PropertiesPanel`, `ActivityTimeline`, `AssociationsPanel`, `deal-line-items`, `AiSummaryPanel`, `StageTracker`, `KanbanBoard`, `deals-board`, `tickets-board`, `meetings-panel`, `job-postings-panel`, `pipeline-insights-panel`, `whatsapp-conversations`, `chat-thread` etc):

- Garantir que ao salvar, invalidem as keys de sua entidade **e** as keys de agregados dependentes (ex.: salvar item de linha invalida `[deal, id]` porque o valor do deal é derivado).
- Documentar dependências no arquivo `src/lib/entity-queries.ts`.

### Fase 7 — CrudSettings e EntityList

Ambos alimentam a maioria das telas de settings/listagem genéricas. Ajustar uma vez:

- `EntityList` (usado em `notes.tsx` e outras): garantir que o dialog interno de create/edit invalide a query da lista após save.
- `CrudSettings`: idem para todas as rotas de settings (playbooks, snippets, pipelines, loss_reasons, lead_sources, task_queues, subscription_types, quote_templates, sequences, macros, sla_policies, forms, feature_flags, email_templates, dunning_policies, etc).

Uma única correção nesses dois componentes elimina o bug em dezenas de telas simultaneamente.

### Fase 8 — Kanbans / Boards

`deals-board`, `tickets-board`, `entity-board`, `candidates-board` — invalidar a key da lista após qualquer drop/edit inline ou modal aberto a partir do card.

## Fora do escopo

- Alterar RLS, schema, edge functions, lógica dos handlers `save`.
- Refatorar 100% dos componentes para Query (só onde reduz o bug).
- Mudar layout ou UX visual dos modais.

## Validação manual

Roteiro de smoke test cobrindo cada área principal:

1. Leads: editar propriedade inline no `PropertiesPanel` → fechar → valor atualizado sem F5.
2. Contatos: criar contato via `create-contact-dialog` → aparece na lista.
3. Empresas: enriquecer CNPJ via modal → detalhe atualiza sem refresh.
4. Deals: adicionar/remover item de linha → header do deal e valor total refletem.
5. Deals: mover card no kanban → posição persistida sem flicker duplo.
6. Tickets: editar ticket em modal → board atualiza.
7. Activities: adicionar nota/comentário/menção → timeline aparece imediatamente.
8. Meetings: criar reunião no drawer → aparece na timeline do deal.
9. ATS: mudar stage de candidato → pipeline reflete; scorecard salvo aparece.
10. Cotações: salvar step do wizard → lista de cotações do deal atualiza.
11. Settings genéricos (playbooks, snippets, pipelines): criar/editar em modal → lista atualiza.
12. Alt-tab da aba e voltar → todas as listas revalidam.

## Detalhes técnicos

- `QueryClient` update em `src/router.tsx` — mudança de 2 linhas com efeito global.
- `useInvalidateOnClose(open, keys)`:
  ```ts
  const qc = useQueryClient();
  const prev = useRef(open);
  useEffect(() => {
    if (prev.current && !open) keys.forEach(k => qc.invalidateQueries({ queryKey: k }));
    prev.current = open;
  }, [open]);
  ```
- Convenção de keys documentada em `src/lib/entity-queries.ts` com constantes `qk.lead(id)`, `qk.leadList(filters)`, etc. Ajuda a manter consistência ao invalidar.
- Realtime: usar `useRealtimeInvalidate([{ table: "leads", queryKeys: [qk.lead(id)] }])` nas rotas de detalhe.

## Riscos

- `refetchOnWindowFocus: true` aumenta tráfego. Mitigado pelo `staleTime: 60s` já configurado.
- Cascatas de invalidação em telas grandes podem flickar; usar `placeholderData: keepPreviousData` onde já houver dados.
- Alterar contrato de modais em massa pode quebrar alguma tela pouco usada — cobrir com `bun run typecheck` e teste manual das telas listadas.

## Execução em fases

Sugerido merge por fase para minimizar risco:

1. Fase 1 + 2 (defaults + hooks) — imediato.
2. Fase 7 (`CrudSettings` + `EntityList`) — cobre dezenas de telas simples.
3. Fase 3 + 6 (contrato modais + componentes compostos das entidades principais).
4. Fase 4 + 5 (Query + Realtime nas rotas de detalhe).
5. Fase 8 (boards).
