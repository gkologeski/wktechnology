## Diagnóstico

A timeline do negócio busca reuniões via RPC `get_entity_timeline`, que espelha `calendar_events` em Deals/Companies pelo campo `calendar_events.related_contact_id`. Se esse campo estiver NULL, o evento não aparece em nenhum deal — mesmo que o e-mail do contato esteja em `attendees`.

### Caso concreto (leonardo.castro@ipstrack.com.br)

- Eventos: `WK Technology <> DIP TRACK...` (10/07 17:00) e `REUNIÃO TÉCNICA / ... DIP TRACK...` (13/07 22:00).
- `attendees` contém `leonardo.castro@ipstrack.com.br` corretamente.
- Contato `f83dcf0d... / Leonardo Castro` existe com esse e-mail e o mesmo `owner_id` da conta do Google.
- Ambos os eventos estão com **`related_contact_id = NULL`**.

**Causa raiz:** ordem temporal.
- Eventos sincronizados em `2026-07-10 17:15` e `17:30`.
- Contato criado em `2026-07-10 17:37:58` (depois).

No momento do sync, o `matchContactForAttendees` rodou, não achou contato com aquele e-mail e gravou `related_contact_id = NULL`. A partir daí:
- O sync do Google é incremental (`syncToken`) → eventos que não mudam no Google **não voltam** nas próximas execuções.
- "Sincronizar agora" → 0 atualizações → o vínculo com contato **nunca é recalculado**.
- "Sincronizar gravações" só busca vídeos no Drive; não mexe em `related_contact_id`.

Resultado: qualquer contato criado **depois** do evento (fluxo comum: cria a reunião, depois cadastra o lead/contato) fica invisível na timeline do deal, para sempre.

### Bug secundário (já reportado antes)

Em `src/lib/calendar/engine.server.ts`, `matchContactForAttendees` trata `organizer=true` como "interno", o que exclui o próprio cliente quando ele foi quem criou o convite. Deve ser mantida a correção no mesmo edit.

---

## Correção proposta

### 1. `src/lib/calendar/engine.server.ts` — corrigir regra de "interno"

Trocar o loop de detecção de domínios internos para considerar apenas `self=true` (mais `accountDomain` como fallback). `organizer` deixa de implicar interno.

### 2. Reconciliação automática quando um contato é criado

Nova serverFn `reconcileCalendarContactMatches` em `src/lib/calendar/engine.server.ts` (e wrapper em `.functions.ts`), que recebe `contactId` e:
- Lê `owner_id`, `workspace_id` e `email` do contato.
- Faz `UPDATE calendar_events SET related_contact_id = <id> WHERE workspace_id=? AND owner_id=? AND related_contact_id IS NULL AND attendees::text ILIKE '%<email>%'` (com re-validação em memória do e-mail e da regra de "interno" para evitar falso positivo).

Gatilho: chamar essa função ao **criar** e ao **atualizar e-mail** de contato, no fluxo existente de contatos (hook onSuccess da mutation), de forma "fire and forget" para não bloquear a UX. Se houver criação de contato via CSV/importador, chamar em batch ao final da importação.

### 3. Rematch no "Sincronizar agora"

Após o loop de sync incremental por conta, rodar uma passada de reconciliação: selecionar `calendar_events` daquela `calendar_account_id` com `related_contact_id IS NULL` e `attendees` não-vazio dos últimos 90 dias (janela suficiente para reuniões atuais e futuras), reaplicar `matchContactForAttendees` e atualizar quando houver match. Isso conserta:
- Eventos históricos afetados pelo bug do organizer.
- Eventos cujos contatos foram criados depois.
- Reexecuções após correções em contatos.

Somar essas linhas ao contador retornado ("N atualizações"), para que o botão pare de reportar 0 quando efetivamente atualizar vínculos.

### 4. Backfill único do estado atual

Rota temporária protegida `src/routes/api/public/hooks/backfill-calendar-contacts.ts` (padrão `reschedule-cron.ts`, autenticada por `CRON_SECRET`), executa a mesma reconciliação da etapa 3 para **todos** os eventos do workspace sem `related_contact_id`. Rodar via `curl`, medir e **remover a rota + limpar `routeTree.gen.ts`** ao final.

### 5. Validação

- Confirmar que os dois eventos DIP TRACK passaram a ter `related_contact_id = f83dcf0d...`.
- Abrir o deal correspondente e ver as reuniões na timeline.
- Executar `typecheck`.

---

## Fora do escopo

- Não vou alterar `get_entity_timeline` — está correta; o problema é a origem de dados.
- Não vou mexer na UI da timeline nem nos botões.
- Não vou introduzir migration de schema (a solução usa colunas existentes).

## Riscos

- Baixo. O `UPDATE` só preenche onde está NULL e usa o mesmo matcher (owner+workspace+e-mail exato, exclui domínios internos).
- A passada extra no "Sincronizar agora" tem custo O(eventos_sem_contato_90d) por conta, aceitável para o volume atual.
- Se um contato mudar de e-mail, a reconciliação por criação/atualização cobre; eventos vinculados anteriormente ao e-mail antigo continuam apontando para o contato — comportamento desejado.
