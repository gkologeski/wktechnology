## Objetivo

Hoje, quando outro usuário (ou uma automação/webhook) cria uma vaga, candidato, deal, lead, contato, tarefa, ticket, reunião ou empresa, o registro **só aparece após refresh manual**. Vamos usar Realtime do Supabase para invalidar as queries automaticamente em INSERT/UPDATE/DELETE.

Já temos o padrão pronto em `src/hooks/use-chat-realtime.ts` (chat) e nos inboxes de chat/WhatsApp. Vamos generalizá-lo e aplicar nas listas de negócio.

## Escopo — páginas que ganham realtime

| Página | Tabela(s) | Query key a invalidar |
|---|---|---|
| Vagas (ATS) — `jobs.index.tsx` | `ats_jobs` | migrar para react-query com key `["ats-jobs"]` e assinar |
| Candidatos (ATS) — `candidates.index.tsx` | `ats_candidates` | `["ats-candidates"]` |
| Deals (board + drawer) — `deals.tsx` | `deals` | `["deals"]` |
| Contatos — `contacts.tsx` | `contacts` | `["contacts"]` |
| Leads — `leads.tsx` | `leads` | `["leads"]` |
| Reuniões — `meetings.tsx` | `calendar_events` (agenda) e/ou `meetings` | `["meetings"]` |
| Tickets — `tickets.tsx` | `tickets` | `["tickets"]` |
| Tarefas/Atividades — `tasks.tsx` | `activities` | `["tasks"]` |
| Empresas — `companies.tsx` | `companies` | `["companies"]` |

Fora de escopo (já têm realtime): chat, inbox chat, inbox WhatsApp, notificações.

## Como vamos implementar

### 1. Migration — habilitar Realtime nas tabelas

Hoje só chat/whatsapp/notifications/enrichment estão em `supabase_realtime`. Adicionar:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.ats_jobs, public.ats_candidates,
  public.deals, public.contacts, public.leads,
  public.tickets, public.activities, public.companies,
  public.calendar_events;
```

RLS já filtra o payload — cada cliente só recebe linhas do seu workspace.

### 2. Hook genérico `useRealtimeInvalidate`

Novo arquivo `src/hooks/use-realtime-invalidate.ts`, baseado em `use-chat-realtime.ts`:

- Recebe `{ table, event = "*", queryKeys: QueryKey[], channelName? }`.
- Cria um `supabase.channel(...)` dentro de `useEffect`, com listener `postgres_changes`.
- No callback, `queryClient.invalidateQueries({ queryKey })` para cada key.
- Fecha o canal ao desmontar e ao `document.hidden` (economiza conexões), reabre quando a aba volta.
- Suporta múltiplas tabelas no mesmo canal para reduzir conexões (ex.: deals + activities no board de deals).

Assinatura resumida:
```ts
useRealtimeInvalidate([
  { table: "deals", queryKeys: [["deals"]] },
  { table: "activities", queryKeys: [["deals", "next-activities"]] },
]);
```

### 3. Aplicar o hook em cada página

Uma linha por página, dentro do componente. Exemplo em `contacts.tsx`:
```ts
useRealtimeInvalidate([{ table: "contacts", queryKeys: [["contacts"]] }]);
```

### 4. Ajuste específico em `jobs.index.tsx`

Hoje ele usa `useState` + `useServerFn` cru, sem react-query — por isso nem invalidação nem realtime funcionam. Vamos migrar para `useQuery({ queryKey: ["ats-jobs", filtros], queryFn: () => listAtsJobs(...) })` e então assinar realtime com a key `["ats-jobs"]`. Sem essa migração, o realtime não tem o que invalidar.

Também remover o `refresh()` manual do fluxo de criação — ao invalidar a query, a lista atualiza sozinha (o INSERT do próprio usuário também dispara o evento).

### 5. Verificação

- Abrir duas abas com usuários diferentes do mesmo workspace.
- Criar vaga/deal/contato em uma → aparecer na outra em < 1s, sem refresh.
- Repetir para cada uma das 9 páginas.
- Confirmar no DevTools que existe apenas 1 canal WebSocket por página (não vazando).

## Escopo restrito

- Sem mudanças de UI, tema, layout ou permissões.
- Sem alterar RLS — Realtime respeita as policies existentes (`shares_workspace_with` etc.), então o filtro por workspace continua garantido.
- Sem tocar em fluxos de mutação além de:
  - migrar `jobs.index.tsx` para react-query (necessário para o realtime funcionar);
  - remover `refresh()` manual redundante em criações locais quando já houver invalidação por realtime.

## Riscos & mitigação

- **Conexões Realtime**: agrupar tabelas relacionadas no mesmo canal e desligar em `document.hidden`.
- **Refetch em cascata**: usar `invalidateQueries` (marca stale) em vez de `refetchQueries` — o react-query só refaz o fetch se a query estiver ativa na tela.
- **Loops**: como o evento dispara também para o próprio usuário, garantir que `onSuccess` de mutations não faça `router.invalidate()` adicional além do invalidate do react-query.

## Entregáveis

1. Migration adicionando 9 tabelas ao `supabase_realtime`.
2. `src/hooks/use-realtime-invalidate.ts`.
3. Chamadas do hook em jobs, candidates, deals, contacts, leads, meetings, tickets, tasks, companies.
4. Refactor mínimo em `jobs.index.tsx` para usar react-query.
