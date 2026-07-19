
# Sprint H — Contas a Pagar/Receber avançado

Adiciona três recursos ao TechFinance sem alterar módulos vizinhos (Banking, DRE, NFS-e).

## Escopo

1. **Parcelamentos de lançamentos** (AR e AP)
2. **Recorrências de lançamentos** (independentes de `recurring_plans`, que é para produtos de assinatura)
3. **Conciliação bancária em massa** (múltiplas transações → múltiplos lançamentos, ações em lote)

Fora do escopo: cobrança automática via Banking (já existe na Sprint G), assinaturas SaaS, boletos recorrentes, notificações por e-mail.

---

## 1. Parcelamentos

### Modelo
Migration em `financial_entries`:
- `parent_entry_id uuid null references financial_entries(id) on delete set null`
- `installment_number smallint null`
- `installment_total smallint null`
- Index `(parent_entry_id, installment_number)`

Nenhum registro existente é alterado. Um lançamento "parcela pai" fica marcado com `installment_total > 1` e cada filho aponta para ele com `installment_number 1..N`.

### Server functions (`src/lib/finance.functions.ts`)
- `createInstallments({ base, count, first_due_date, cadence: 'monthly'|'weekly'|'custom_days', custom_interval_days?, split_mode: 'equal'|'first_bigger'|'custom_amounts', custom_amounts? })` — insere N linhas na `financial_entries` numa transação lógica, ratateando `amount` (com correção de centavos na última parcela), preenchendo `parent_entry_id`, `installment_number`, `installment_total`, herdando `direction`, `category_id`, `counterparty_company_id`, `origin_type='installment'`, `origin_id = parent.id`.
- `listInstallmentSiblings({ entry_id })` — devolve todas as parcelas do mesmo `parent_entry_id`.
- `deleteInstallmentGroup({ parent_entry_id })` — apaga parcelas ainda `pending`; parcelas `paid` são preservadas e o retorno lista quais ficaram.

### UI
- `QuickCreateEntryDialog`: adicionar toggle "Parcelar em N vezes", campos de cadência e método de divisão. Preview das parcelas antes de salvar.
- `finance.entries.$id.tsx`: card "Parcelamento" quando `parent_entry_id` ou `installment_total > 1`, com lista de irmãs, links e ação "Excluir parcelas em aberto".
- `finance.payable.tsx` / `finance.receivable.tsx`: coluna `Parcela` (ex.: `2/6`) visível quando existir.

---

## 2. Recorrências AR/AP

Tabela nova (não confundir com `recurring_plans` que é catálogo de assinaturas de produto):

`public.financial_recurrences`
- `id`, `workspace_id`, `owner_id`
- `direction` (`in`/`out`), `template jsonb` (descrição, valor, categoria, contraparte, método, notas)
- `cadence` (`weekly`|`monthly`|`yearly`|`custom_days`), `interval_days smallint null`
- `start_date`, `end_date null`, `max_occurrences smallint null`, `occurrences_generated smallint default 0`
- `next_run_date`, `day_of_month smallint null`, `active boolean default true`
- `last_generated_entry_id uuid null`

Grants + RLS: `SELECT/INSERT/UPDATE/DELETE` só quando `auth.uid() = owner_id` (mesma linha de `financial_entries`). Grant para `authenticated` e `service_role`.

### Server functions (`src/lib/finance-recurrences.functions.ts`)
- CRUD (`listRecurrences`, `upsertRecurrence`, `toggleRecurrence`, `deleteRecurrence`).
- `runDueRecurrencesForWorkspace()` — só usada pelo cron; percorre recorrências ativas com `next_run_date <= today`, cria `financial_entries` (respeita `origin_type='recurrence'`, `origin_id=recurrence.id`), avança `next_run_date` conforme cadência, incrementa `occurrences_generated`, e desativa quando `end_date`/`max_occurrences` atingidos.

### Cron
- Rota `src/routes/api/public/hooks/finance-recurrences-tick.ts` que valida `apikey` (anon key) e chama uma função server-only que usa `supabaseAdmin` para varrer todos os workspaces.
- Agenda `pg_cron` diária às 06:00 chamando essa rota com `body:'{}'`.

### UI
- Nova rota `/finance/recurrences` com lista, criar/editar (formulário reutiliza campos do `QuickCreateEntryDialog`), toggle Ativa/Pausada e histórico dos últimos lançamentos gerados.
- Link na sidebar de Finance (ao lado de "A Pagar"/"A Receber").
- Detalhe do lançamento aponta para a recorrência quando `origin_type='recurrence'`.

---

## 3. Conciliação em massa

Extensão de `src/routes/_authenticated/finance.banking.reconciliation.tsx`:

- Checkbox por linha de `bank_statement_transactions` com estado indeterminado no header.
- Barra flutuante com ações quando há seleção:
  - **Sugerir matches** (executa `suggestBulkMatches` — vincula automaticamente cada transação selecionada ao `financial_entry` com mesmo `amount`+direção+data ±3 dias).
  - **Vincular ao lançamento…** (dialog escolhendo entrada única; aplica a todas as selecionadas do mesmo direction).
  - **Criar lançamento a partir da transação** (para cada transação, cria `financial_entries` com `origin_type='bank_statement'`, direction correta, `paid_amount=amount`, status `paid`, categoria opcional em dialog único).
  - **Ignorar** (marca `reconciliation_status='ignored'`).

Server functions em `src/lib/banking.functions.ts` (ou novo `banking-reconciliation.functions.ts`):
- `suggestBulkMatches({ transaction_ids })` → devolve pares sugeridos sem gravar.
- `applyBulkMatches({ pairs: [{ transaction_id, entry_id }] })` — grava `matched_payment_id` (via `financial_payments`) e atualiza `reconciliation_status='matched'` em lote.
- `bulkCreateEntriesFromTransactions({ transaction_ids, category_id? })` — cria entradas em lote e concilia.
- `bulkIgnoreTransactions({ transaction_ids })`.

Todos validam `workspace_id` da transação vs. do lançamento antes de gravar; nenhuma ação depende de RLS bypass.

---

## Detalhes técnicos

### Migrations
1. Adição de colunas em `financial_entries` (parcelamento).
2. Criação de `financial_recurrences` seguindo o padrão obrigatório (CREATE TABLE → GRANT → ENABLE RLS → POLICY por `auth.uid()=owner_id`).
3. Trigger `update_updated_at_column` em `financial_recurrences`.

### Frontend
- Componentes UI TechHire oficiais: `FormSection`, `SectionHeader`, `EmptyState`, `LoadingSkeleton`, `DataTable`, `StatusBadge`.
- Nenhuma alteração no design system nem em Banking Health (Sprint G Fase 6).
- Refetch pós-mutação via `useInvalidateOnClose` / `queryClient.invalidateQueries` para as chaves `["financial-entries"]`, `["financial-recurrences"]`, `["bank-statement-transactions"]`.

### Segurança
- Todas as server functions usam `requireSupabaseAuth` e validam `workspace_id`/`owner_id`.
- Rota pública do cron valida `apikey` (anon key) e é a única superfície que chama `supabaseAdmin`.
- Sem novos secrets.

### Testes / Validação manual
1. Criar lançamento parcelado em 6× e ver 6 linhas em `/finance/payable`, com badge `1/6…6/6`.
2. Pagar 3 parcelas → excluir grupo → só as `pending` são removidas.
3. Criar recorrência mensal com `max_occurrences=3`, rodar o hook manualmente e ver 3 lançamentos gerados e a recorrência desativada.
4. Selecionar 5 transações de extrato → "Sugerir matches" → "Aplicar" → todas conciliadas.
5. Selecionar 3 transações órfãs → "Criar lançamento" com categoria → aparecem em `/finance/entries` já pagas.

## Entregas por fase

```text
Fase 1: Parcelamentos (migration + server fns + UI)
Fase 2: Recorrências (migration + server fns + UI + cron)
Fase 3: Conciliação em massa (server fns + UI da reconciliação)
```

Cada fase termina com validação manual + relatório final antes de avançar para a próxima.
