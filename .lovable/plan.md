## Objetivo

Quando o usuário cria uma associação entre duas entidades (Contato, Empresa, Deal, Lead, Ticket), exibir um seletor de período (**30 / 60 / 90 / 180 dias / Desde sempre**) e propagar retroativamente as atividades da entidade vinculada dentro daquela janela, para que apareçam na timeline da outra entidade — igual ao HubSpot.

## Comportamento

- Seletor aparece em **toda** UI de associação: Contato↔Deal, Contato↔Empresa, Empresa↔Deal, Lead↔(Contato/Empresa/Deal), Ticket↔(Contato/Empresa/Deal).
- Opções: `30d`, `60d`, `90d`, `180d`, `Desde sempre`. Padrão: **Desde sempre** (igual HubSpot).
- Aplica a **todos os tipos** de atividade (`note, task, call, email, meeting, whatsapp, sms, postal_mail, linkedin_message`).
- Ao **desvincular**, atividades retro-propagadas **permanecem** (HubSpot-like) — sem rollback.

## Como funciona tecnicamente

O modelo atual já usa FKs diretas em `activities` (`related_contact_id`, `related_company_id`, `related_deal_id`, `related_lead_id`, `related_ticket_id`) — não há tabela de join. "Trazer histórico" = preencher essas FKs nas atividades existentes da entidade de origem que ainda não as têm.

### 1. Server function: `propagateHistoryOnLink`

Novo arquivo `src/lib/associations.functions.ts`:

```ts
propagateAssociationHistory({
  sourceEntity: { kind: 'contact'|'company'|'deal'|'lead'|'ticket', id: string },
  targetEntity: { kind: ..., id: string },
  windowDays: number | null,   // null = desde sempre
})
```

- `requireSupabaseAuth`, RLS como usuário.
- Resolve a coluna alvo (`related_<targetKind>_id`).
- `UPDATE activities SET related_<target>_id = $targetId WHERE related_<source>_id = $sourceId AND related_<target>_id IS NULL AND ($window IS NULL OR coalesce(activity_date, created_at) >= now() - interval '$window days')`.
- Bidirecional: roda nos dois sentidos (atividades do contato ganham `related_deal_id`, atividades do deal ganham `related_contact_id`) — assim a timeline de ambos os lados é coerente.
- Retorna `{ propagatedFromSource, propagatedFromTarget }` para feedback ("23 atividades vinculadas").

### 2. Componente compartilhado `<AssociationPeriodSelect />`

`src/components/associations/association-period-select.tsx` — `RadioGroup` com as 5 opções, padrão "Desde sempre". Reutilizado em todos os diálogos.

### 3. Pontos de integração (UI)

Em cada diálogo/comando de vínculo, adicionar o seletor e chamar `propagateAssociationHistory` após o insert/update do vínculo:

- **Contato ↔ Deal**: diálogo "Adicionar contato" no Deal (insert em `deal_contacts`) e ao setar `deals.primary_contact_id`.
- **Contato ↔ Empresa**: ao setar `contacts.company_id` (form de contato + ação rápida).
- **Empresa ↔ Deal**: ao setar `deals.company_id` no form/sidebar do Deal.
- **Lead ↔ \***: ao preencher `leads.related_*_id`.
- **Ticket ↔ \***: ao preencher `tickets.related_contact_id / related_company_id / related_deal_id`.

Toast de confirmação: "X atividades trazidas para a timeline".

### 4. Auto-link já existente (`resolveAutoLinks`)

`activity-timeline.tsx` já propaga FKs em **novas** atividades (Deal → Company/Contact primário). Mantém-se inalterado. O novo fluxo cobre **atividades passadas**, que `resolveAutoLinks` não toca.

### 5. Sem migration

Nenhuma mudança de schema. Apenas updates em `activities` via RLS. O seletor é estado local do diálogo — não persistimos a escolha.

## Fora de escopo

- Não cria tabela de join nem rastreia "origem" da propagação.
- Não há undo / rollback ao desvincular (decisão confirmada).
- Não toca em `calendar_events` (Google Calendar resolve guest→contact por outro caminho).
